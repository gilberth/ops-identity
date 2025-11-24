import pako from 'pako';

// Use empty string for production (relative URLs), localhost for development
const VPS_ENDPOINT = import.meta.env.VITE_VPS_ENDPOINT !== undefined 
    ? import.meta.env.VITE_VPS_ENDPOINT 
    : 'http://localhost:3000';

export const api = {
    async getAssessments() {
        const response = await fetch(`${VPS_ENDPOINT}/api/assessments`);
        if (!response.ok) throw new Error('Failed to fetch assessments');
        return response.json();
    },

    async getAssessment(id: string) {
        const response = await fetch(`${VPS_ENDPOINT}/api/assessments/${id}`);
        if (!response.ok) throw new Error('Failed to fetch assessment');
        return response.json();
    },

    async getFindings(id: string) {
        const response = await fetch(`${VPS_ENDPOINT}/api/assessments/${id}/findings`);
        if (!response.ok) throw new Error('Failed to fetch findings');
        return response.json();
    },

    async getLogs(id: string) {
        const response = await fetch(`${VPS_ENDPOINT}/api/assessments/${id}/logs`);
        if (!response.ok) throw new Error('Failed to fetch logs');
        return response.json();
    },

    async deleteAssessment(id: string) {
        const response = await fetch(`${VPS_ENDPOINT}/api/assessments/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete assessment');
        return response.json();
    },

    async resetAssessment(id: string) {
        const response = await fetch(`${VPS_ENDPOINT}/api/assessments/${id}/reset`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to reset assessment');
        return response.json();
    },

    async createAssessment(domain: string) {
        const response = await fetch(`${VPS_ENDPOINT}/api/assessments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain }),
        });
        if (!response.ok) throw new Error('Failed to create assessment');
        return response.json();
    },

    getAssessmentData: async (id: string) => {
        const response = await fetch(`${VPS_ENDPOINT}/api/assessments/${id}/data`);
        if (!response.ok) throw new Error('Failed to fetch assessment data');
        
        // Get response as ArrayBuffer to handle gzip compressed data
        const arrayBuffer = await response.arrayBuffer();
        
        // Decompress gzip data manually (in case browser doesn't auto-decompress)
        try {
            const uint8Array = new Uint8Array(arrayBuffer);
            const decompressed = pako.ungzip(uint8Array, { to: 'string' });
            return JSON.parse(decompressed);
        } catch (e) {
            // If decompression fails, try parsing as regular JSON (already decompressed by browser)
            const text = new TextDecoder().decode(arrayBuffer);
            return JSON.parse(text);
        }
    },

    async getAiConfig() {
        const response = await fetch(`${VPS_ENDPOINT}/api/ai-config`);
        if (!response.ok) throw new Error('Failed to fetch AI config');
        return response.json();
    },

    async updateAiConfig(provider: string) {
        const response = await fetch(`${VPS_ENDPOINT}/api/ai-config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider }),
        });
        if (!response.ok) throw new Error('Failed to update AI config');
        return response.json();
    },
};
