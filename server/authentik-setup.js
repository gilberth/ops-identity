import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebAuthentikSetup {
    constructor(baseUrl, apiToken, appUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiToken = apiToken;
        this.appUrl = appUrl.replace(/\/$/, '');
        this.appName = "Active Scan Insight";
        this.appSlug = "active-scan-insight";
    }

    async apiRequest(method, endpoint, data = null) {
        const url = `${this.baseUrl}/api/v3/${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
        };

        const options = {
            method,
            headers,
            timeout: 10000 // 10s timeout
        };

        if (data && method === 'POST') {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.detail) errorMsg = errorJson.detail;
                    else if (errorJson.error) errorMsg = errorJson.error;
                    else if (typeof errorJson === 'object') {
                        const errors = Object.entries(errorJson).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
                        if (errors.length > 0) errorMsg = errors.join('; ');
                    }
                } catch (e) {
                    // ignore parse error
                }
                return { error: errorMsg };
            }

            return await response.json();
        } catch (error) {
            return { error: `Connection failed: ${error.message}` };
        }
    }

    async validateConnection() {
        const result = await this.apiRequest('GET', 'core/applications/');
        if (result && !result.error) {
            return { success: true };
        }
        return result;
    }

    async getDefaultFlow(flowType = 'authentication') {
        const flows = await this.apiRequest('GET', 'flows/instances/');
        if (flows && !flows.error && flows.results) {
            // Find flow by slug or designation
            for (const flow of flows.results) {
                const slug = (flow.slug || '').toLowerCase();
                const designation = (flow.designation || '').toLowerCase();
                if (slug.includes(flowType) || designation.includes(flowType)) {
                    return flow.pk;
                }
            }
            // Fallback to first available flow if results exist
            if (flows.results.length > 0) {
                return flows.results[0].pk;
            }
        }
        return null;
    }

    async createOAuthProvider() {
        // Check if provider exists
        const providers = await this.apiRequest('GET', 'providers/oauth2/');
        if (providers && !providers.error && providers.results) {
            for (const provider of providers.results) {
                if (provider.name === this.appName) {
                    return {
                        success: true,
                        provider,
                        message: 'Using existing provider'
                    };
                }
            }
        }

        // Get flows
        const authFlow = await this.getDefaultFlow('authentication');
        if (!authFlow) return { error: 'Could not find authentication flow' };

        let invalidationFlow = await this.getDefaultFlow('invalidation');
        if (!invalidationFlow) invalidationFlow = authFlow;

        // Create provider
        const providerData = {
            name: this.appName,
            authorization_flow: authFlow,
            invalidation_flow: invalidationFlow,
            client_type: 'confidential',
            redirect_uris: [
                {
                    matching_mode: 'strict',
                    url: `${this.appUrl}/callback`
                }
            ],
            sub_mode: 'hashed_user_id',
            include_claims_in_id_token: true
        };

        const provider = await this.apiRequest('POST', 'providers/oauth2/', providerData);
        if (provider && !provider.error) {
            return {
                success: true,
                provider,
                message: 'Provider created successfully'
            };
        }
        return provider;
    }

    async createApplication(providerPk) {
        // Check if app exists
        const apps = await this.apiRequest('GET', 'core/applications/');
        if (apps && !apps.error && apps.results) {
            for (const app of apps.results) {
                if (app.slug === this.appSlug) {
                    return {
                        success: true,
                        application: app,
                        message: 'Using existing application'
                    };
                }
            }
        }

        // Create app
        const appData = {
            name: this.appName,
            slug: this.appSlug,
            provider: providerPk,
            meta_launch_url: this.appUrl
        };

        const application = await this.apiRequest('POST', 'core/applications/', appData);
        if (application && !application.error) {
            return {
                success: true,
                application,
                message: 'Application created successfully'
            };
        }
        return application;
    }

    async setup() {
        // 1. Validate
        const validation = await this.validateConnection();
        if (validation.error) {
            return { success: false, step: 'validation', error: `Connection failed: ${validation.error}` };
        }

        // 2. Create Provider
        const providerResult = await this.createOAuthProvider();
        if (providerResult.error) {
            return { success: false, step: 'provider', error: `Provider creation failed: ${providerResult.error}` };
        }
        const provider = providerResult.provider;

        // 3. Create Application
        const appResult = await this.createApplication(provider.pk);
        if (appResult.error) {
            return { success: false, step: 'application', error: `Application creation failed: ${appResult.error}` };
        }

        // 4. Save to .env
        try {
            const envPath = path.resolve(__dirname, '.env');
            let envContent = '';

            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            } else if (fs.existsSync(path.resolve(__dirname, '.env.example'))) {
                envContent = fs.readFileSync(path.resolve(__dirname, '.env.example'), 'utf8');
            }

            const newVars = {
                ENABLE_AUTH: 'true',
                AUTHENTIK_BASE_URL: this.baseUrl,
                AUTHENTIK_CLIENT_ID: provider.client_id,
                AUTHENTIK_CLIENT_SECRET: provider.client_secret,
                AUTHENTIK_SLUG: this.appSlug,
                AUTHENTIK_REDIRECT_URI: `${this.appUrl}/callback`,
                AUTHENTIK_API_TOKEN: this.apiToken
            };

            // Parse existing env to avoid duplicates
            const envLines = envContent.split('\n');
            const envMap = {};
            envLines.forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    envMap[match[1].trim()] = match[2].trim();
                }
            });

            // Update with new vars
            Object.assign(envMap, newVars);

            // Reconstruct content
            const newEnvContent = Object.entries(envMap)
                .map(([k, v]) => `${k}=${v}`)
                .join('\n');

            fs.writeFileSync(envPath, newEnvContent);

            return {
                success: true,
                client_id: provider.client_id,
                client_secret: provider.client_secret ? (provider.client_secret.substring(0, 10) + '...') : '******',
                redirect_uri: `${this.appUrl}/callback`,
                provider_message: providerResult.message,
                app_message: appResult.message
            };

        } catch (e) {
            return { success: false, step: 'env_save', error: `Failed to save .env: ${e.message}` };
        }
    }
}
