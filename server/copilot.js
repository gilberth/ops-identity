/**
 * GitHub Copilot Integration for OpsIdentity
 * 
 * This module implements the OAuth Device Flow for GitHub Copilot authentication
 * and provides a client for the Copilot Chat Completions API.
 * 
 * Based on OpenCode implementation: https://github.com/anomalyco/opencode
 * 
 * @version 1.0.0
 * @author OpsIdentity Team
 */

import fetch from 'node-fetch';

// =============================================================================
// COPILOT CONSTANTS (from OpenCode)
// =============================================================================
const COPILOT_CONSTANTS = {
  CLIENT_ID: 'Iv1.b507a08c87ecfe98',
  OAUTH_SCOPE: 'read:user',
  USER_AGENT: 'GitHubCopilotChat/0.35.0',
  EDITOR_VERSION: 'vscode/1.107.0',
  PLUGIN_VERSION: 'copilot-chat/0.35.0',
  INTEGRATION_ID: 'vscode-chat',
  
  // Endpoints
  DEVICE_CODE_URL: 'https://github.com/login/device/code',
  ACCESS_TOKEN_URL: 'https://github.com/login/oauth/access_token',
  COPILOT_TOKEN_URL: 'https://api.github.com/copilot_internal/v2/token',
  CHAT_COMPLETIONS_URL: 'https://api.githubcopilot.com/chat/completions',
  MODELS_URL: 'https://api.githubcopilot.com/models',
  
  // Token refresh buffer (5 minutes before expiration)
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000
};

// Available models in GitHub Copilot - Only Claude 4.5 models
const COPILOT_MODELS = [
  { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', description: 'Anthropic - Most capable model' },
  { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Anthropic - Balanced performance' }
];

/**
 * CopilotClient - Handles GitHub Copilot authentication and API calls
 */
class CopilotClient {
  constructor(getConfigFn, setConfigFn) {
    this.getConfig = getConfigFn;
    this.setConfig = setConfigFn;
    
    // In-memory cache for tokens (faster than DB lookups)
    this._tokenCache = {
      githubToken: null,
      internalToken: null,
      tokenExpires: null,
      userLogin: null
    };
  }

  /**
   * Load tokens from database into cache
   */
  async _loadTokensFromDB() {
    try {
      const [githubToken, internalToken, tokenExpires, userLogin] = await Promise.all([
        this.getConfig('copilot_github_token'),
        this.getConfig('copilot_internal_token'),
        this.getConfig('copilot_token_expires'),
        this.getConfig('copilot_user_login')
      ]);
      
      this._tokenCache = {
        githubToken,
        internalToken,
        tokenExpires: tokenExpires ? parseInt(tokenExpires) : null,
        userLogin
      };
    } catch (error) {
      console.error('[Copilot] Error loading tokens from DB:', error.message);
    }
  }

  /**
   * Save tokens to database and update cache
   */
  async _saveTokensToDB(tokens) {
    try {
      const promises = [];
      
      if (tokens.githubToken !== undefined) {
        this._tokenCache.githubToken = tokens.githubToken;
        promises.push(this.setConfig('copilot_github_token', tokens.githubToken || ''));
      }
      if (tokens.internalToken !== undefined) {
        this._tokenCache.internalToken = tokens.internalToken;
        promises.push(this.setConfig('copilot_internal_token', tokens.internalToken || ''));
      }
      if (tokens.tokenExpires !== undefined) {
        this._tokenCache.tokenExpires = tokens.tokenExpires;
        promises.push(this.setConfig('copilot_token_expires', tokens.tokenExpires?.toString() || ''));
      }
      if (tokens.userLogin !== undefined) {
        this._tokenCache.userLogin = tokens.userLogin;
        promises.push(this.setConfig('copilot_user_login', tokens.userLogin || ''));
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.error('[Copilot] Error saving tokens to DB:', error.message);
      throw error;
    }
  }

  // ===========================================================================
  // OAuth Device Flow Methods
  // ===========================================================================

  /**
   * Start the OAuth Device Flow
   * Returns device_code, user_code, and verification_uri for user to authorize
   */
  async startDeviceFlow() {
    console.log('[Copilot] Starting OAuth Device Flow...');
    
    try {
      const response = await fetch(COPILOT_CONSTANTS.DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': COPILOT_CONSTANTS.USER_AGENT
        },
        body: new URLSearchParams({
          client_id: COPILOT_CONSTANTS.CLIENT_ID,
          scope: COPILOT_CONSTANTS.OAUTH_SCOPE
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Device flow initiation failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      
      console.log('[Copilot] Device flow initiated successfully');
      console.log(`[Copilot] User code: ${data.user_code}`);
      console.log(`[Copilot] Verification URL: ${data.verification_uri}`);
      
      return {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        expiresIn: data.expires_in,
        interval: data.interval || 5
      };
    } catch (error) {
      console.error('[Copilot] Device flow error:', error.message);
      throw error;
    }
  }

  /**
   * Poll for device authorization
   * Call this repeatedly until success or expiration
   * 
   * @param {string} deviceCode - The device_code from startDeviceFlow
   * @returns {object} - { status: 'pending'|'success'|'expired'|'error', data?: {...} }
   */
  async pollDeviceFlow(deviceCode) {
    try {
      const response = await fetch(COPILOT_CONSTANTS.ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': COPILOT_CONSTANTS.USER_AGENT
        },
        body: new URLSearchParams({
          client_id: COPILOT_CONSTANTS.CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });

      const data = await response.json();

      // Handle different response states
      if (data.error) {
        switch (data.error) {
          case 'authorization_pending':
            // User hasn't authorized yet - keep polling
            return { status: 'pending' };
          
          case 'slow_down':
            // Polling too fast
            console.log('[Copilot] Polling too fast, slowing down...');
            return { status: 'pending', slowDown: true };
          
          case 'expired_token':
            console.log('[Copilot] Device code expired');
            return { status: 'expired' };
          
          case 'access_denied':
            console.log('[Copilot] User denied authorization');
            return { status: 'denied' };
          
          default:
            console.error('[Copilot] Unknown error:', data.error, data.error_description);
            return { status: 'error', error: data.error_description || data.error };
        }
      }

      // Success! We have an access token
      if (data.access_token) {
        console.log('[Copilot] Authorization successful!');
        
        // Get user info
        const userInfo = await this._getUserInfo(data.access_token);
        
        // Save GitHub token (permanent)
        await this._saveTokensToDB({
          githubToken: data.access_token,
          userLogin: userInfo?.login || 'unknown'
        });
        
        // Get Copilot internal token
        await this.refreshCopilotToken();
        
        return {
          status: 'success',
          data: {
            userLogin: userInfo?.login || 'unknown',
            userName: userInfo?.name || userInfo?.login || 'GitHub User'
          }
        };
      }

      return { status: 'error', error: 'Unexpected response' };
    } catch (error) {
      console.error('[Copilot] Poll error:', error.message);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Get GitHub user info from access token
   */
  async _getUserInfo(accessToken) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': COPILOT_CONSTANTS.USER_AGENT,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('[Copilot] Could not fetch user info:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn('[Copilot] Error fetching user info:', error.message);
      return null;
    }
  }

  // ===========================================================================
  // Token Management
  // ===========================================================================

  /**
   * Refresh the internal Copilot token
   * This token is short-lived (~30 min) and needed for API calls
   */
  async refreshCopilotToken() {
    await this._loadTokensFromDB();
    
    const githubToken = this._tokenCache.githubToken;
    if (!githubToken) {
      throw new Error('No GitHub token available. Please authenticate first.');
    }

    console.log('[Copilot] Refreshing internal Copilot token...');

    try {
      const response = await fetch(COPILOT_CONSTANTS.COPILOT_TOKEN_URL, {
        method: 'GET',
        headers: {
          'Authorization': `token ${githubToken}`,
          'User-Agent': COPILOT_CONSTANTS.USER_AGENT,
          'Accept': 'application/json',
          'Editor-Version': COPILOT_CONSTANTS.EDITOR_VERSION,
          'Editor-Plugin-Version': COPILOT_CONSTANTS.PLUGIN_VERSION
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check for specific errors
        if (response.status === 401) {
          console.error('[Copilot] GitHub token is invalid or expired');
          await this.logout();
          throw new Error('GitHub token expired. Please re-authenticate.');
        }
        
        if (response.status === 403) {
          throw new Error('No active Copilot subscription. Please ensure you have GitHub Copilot enabled.');
        }
        
        throw new Error(`Failed to get Copilot token: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Calculate expiration (usually ~30 min from now)
      // The response includes expires_at as Unix timestamp
      const expiresAt = data.expires_at 
        ? data.expires_at * 1000 
        : Date.now() + (30 * 60 * 1000);
      
      await this._saveTokensToDB({
        internalToken: data.token,
        tokenExpires: expiresAt
      });
      
      console.log('[Copilot] Internal token refreshed successfully');
      console.log(`[Copilot] Token expires at: ${new Date(expiresAt).toISOString()}`);
      
      return data.token;
    } catch (error) {
      console.error('[Copilot] Token refresh error:', error.message);
      throw error;
    }
  }

  /**
   * Ensure we have a valid internal token
   * Refreshes if expired or about to expire
   */
  async ensureValidToken() {
    await this._loadTokensFromDB();
    
    const { internalToken, tokenExpires, githubToken } = this._tokenCache;
    
    // Check if we have a GitHub token at all
    if (!githubToken) {
      throw new Error('Not authenticated. Please connect with GitHub first.');
    }
    
    // Check if internal token exists and is still valid
    const now = Date.now();
    const needsRefresh = !internalToken || 
      !tokenExpires || 
      (tokenExpires - now) < COPILOT_CONSTANTS.TOKEN_REFRESH_BUFFER_MS;
    
    if (needsRefresh) {
      console.log('[Copilot] Token needs refresh');
      return await this.refreshCopilotToken();
    }
    
    return internalToken;
  }

  // ===========================================================================
  // Chat Completions API
  // ===========================================================================

  /**
   * Call the Copilot Chat Completions API
   * 
   * @param {Array} messages - Array of { role: 'system'|'user'|'assistant', content: string }
   * @param {string} model - Model ID (e.g., 'gpt-4o', 'claude-3.5-sonnet')
   * @param {object} options - Additional options (temperature, max_tokens, etc.)
   * @returns {object} - The API response
   */
  async chat(messages, model = 'gpt-4o', options = {}) {
    const token = await this.ensureValidToken();
    
    console.log(`[Copilot] Calling chat API with model: ${model}`);
    console.log(`[Copilot] Messages: ${messages.length}, First message role: ${messages[0]?.role}`);

    const requestBody = {
      model: model,
      messages: messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.max_tokens ?? 8192,
      stream: false,
      ...options
    };

    try {
      const response = await fetch(COPILOT_CONSTANTS.CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': COPILOT_CONSTANTS.USER_AGENT,
          'Editor-Version': COPILOT_CONSTANTS.EDITOR_VERSION,
          'Editor-Plugin-Version': COPILOT_CONSTANTS.PLUGIN_VERSION,
          'Copilot-Integration-Id': COPILOT_CONSTANTS.INTEGRATION_ID,
          'Openai-Intent': 'conversation-edits',
          'X-Initiator': 'user'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Handle specific errors
        if (response.status === 401) {
          console.error('[Copilot] Token expired during request, refreshing...');
          await this.refreshCopilotToken();
          // Retry once
          return this.chat(messages, model, options);
        }
        
        if (response.status === 429) {
          throw new Error('Rate limited. Please wait a moment before trying again.');
        }
        
        throw new Error(`Chat API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      console.log(`[Copilot] Response received. Tokens used: ${data.usage?.total_tokens || 'N/A'}`);
      
      return data;
    } catch (error) {
      console.error('[Copilot] Chat error:', error.message);
      throw error;
    }
  }

  /**
   * Simple chat completion that returns just the text content
   * 
   * @param {string} systemPrompt - System message
   * @param {string} userMessage - User message
   * @param {string} model - Model ID
   * @returns {string} - The assistant's response text
   */
  async simpleChat(systemPrompt, userMessage, model = 'gpt-4o') {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];
    
    const response = await this.chat(messages, model);
    
    return response.choices?.[0]?.message?.content || '';
  }

  // ===========================================================================
  // Status & Management
  // ===========================================================================

  /**
   * Get current authentication status
   */
  async getAuthStatus() {
    await this._loadTokensFromDB();
    
    const { githubToken, internalToken, tokenExpires, userLogin } = this._tokenCache;
    
    const isAuthenticated = !!githubToken;
    const now = Date.now();
    const tokenValid = internalToken && tokenExpires && (tokenExpires > now);
    
    return {
      authenticated: isAuthenticated,
      userLogin: userLogin || null,
      tokenValid: tokenValid,
      tokenExpires: tokenExpires ? new Date(tokenExpires).toISOString() : null,
      timeUntilExpiry: tokenExpires ? Math.max(0, tokenExpires - now) : null
    };
  }

  /**
   * Get available models from Copilot API
   * Filtered to show only Claude Opus 4.5 and Sonnet 4.5
   */
  async getModels() {
    // Only return Claude 4.5 models (Opus and Sonnet)
    const ALLOWED_MODELS = [
      { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', description: 'Anthropic - Most capable model' },
      { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Anthropic - Balanced performance' }
    ];
    
    console.log('[Copilot] Returning filtered model list (Claude 4.5 only)');
    return ALLOWED_MODELS;
  }

  /**
   * Logout - Clear all stored tokens
   */
  async logout() {
    console.log('[Copilot] Logging out, clearing tokens...');
    
    await this._saveTokensToDB({
      githubToken: null,
      internalToken: null,
      tokenExpires: null,
      userLogin: null
    });
    
    this._tokenCache = {
      githubToken: null,
      internalToken: null,
      tokenExpires: null,
      userLogin: null
    };
    
    console.log('[Copilot] Logged out successfully');
    return { success: true };
  }
}

// Export the client class and constants
export { CopilotClient, COPILOT_CONSTANTS, COPILOT_MODELS };
export default CopilotClient;
