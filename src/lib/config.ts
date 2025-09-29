export interface AppConfig {
  ai: {
    enabled: boolean;
    apiKey: string;
    model: string;
    timeout: number;
    provider: 'openrouter';
  };
  app: {
    name: string;
    version: string;
    environment: 'development' | 'production';
  };
}

/**
 * Application configuration loaded from environment variables
 * Provides centralized configuration management with fallback values
 */
export class Config {
  private static instance: AppConfig;

  /**
   * Get the application configuration
   * Loads from environment variables with sensible defaults
   */
  static get(): AppConfig {
    if (!this.instance) {
      this.instance = this.loadConfig();
    }
    return this.instance;
  }

  /**
   * Reload configuration from environment variables
   * Useful for testing or dynamic configuration changes
   */
  static reload(): AppConfig {
    this.instance = this.loadConfig();
    return this.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private static loadConfig(): AppConfig {
    const isProduction = import.meta.env.PROD;
    const env = isProduction ? 'production' : 'development';

    // AI Configuration
    const aiEnabled = import.meta.env.VITE_AI_ENABLED !== undefined
      ? import.meta.env.VITE_AI_ENABLED === 'true' || import.meta.env.VITE_AI_ENABLED === '1'
      : true; // Default to enabled

    const aiApiKey = import.meta.env.VITE_OPENROUTER_API_KEY || '';
    const aiModel = import.meta.env.VITE_AI_MODEL || 'openai/gpt-oss-20b:free';
    const aiTimeout = parseInt(import.meta.env.VITE_AI_TIMEOUT || '20000', 10);

    // Validate timeout is reasonable (5 seconds to 5 minutes)
    const validatedTimeout = Math.max(5000, Math.min(300000, aiTimeout));

    return {
      ai: {
        enabled: aiEnabled && !!aiApiKey, // AI is only enabled if both enabled flag is true AND API key exists
        apiKey: aiApiKey,
        model: aiModel,
        timeout: validatedTimeout,
        provider: 'openrouter',
      },
      app: {
        name: 'Crisp - AI Interview Assistant',
        version: '1.0.0',
        environment: env,
      },
    };
  }

  /**
   * Get AI configuration
   */
  static getAIConfig() {
    return this.get().ai;
  }

  /**
   * Get app configuration
   */
  static getAppConfig() {
    return this.get().app;
  }
}

