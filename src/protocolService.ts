import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

export interface ProtocolMetadata {
  protocol_id: string;
  version: string;
  active_medications: string[];
}

export interface ProtocolValidationResult {
  valid: boolean;
  metadata: ProtocolMetadata | null;
  error?: string;
}

/**
 * Decode Base64-encoded protocol metadata from URL parameter
 */
export function decodeProtocolMetadata(encodedMeta: string): ProtocolMetadata | null {
  try {
    const decoded = atob(encodedMeta);
    const parsed = JSON.parse(decoded);

    // Validate required fields
    if (!parsed.protocol_id || !parsed.version || !Array.isArray(parsed.active_medications)) {
      console.error('Invalid protocol metadata structure:', parsed);
      return null;
    }

    return {
      protocol_id: parsed.protocol_id,
      version: parsed.version,
      active_medications: parsed.active_medications,
    };
  } catch (error) {
    console.error('Failed to decode protocol metadata:', error);
    return null;
  }
}

/**
 * Encode protocol metadata to Base64 for URL parameter
 */
export function encodeProtocolMetadata(metadata: ProtocolMetadata): string {
  try {
    return btoa(JSON.stringify(metadata));
  } catch (error) {
    console.error('Failed to encode protocol metadata:', error);
    return '';
  }
}

/**
 * Validate protocol via Cloud Function
 */
export async function validateProtocolWithCloudFunction(
  protocolId: string
): Promise<ProtocolValidationResult> {
  try {
    const validateProtocol = httpsCallable(functions, 'validateProtocol');
    const result = await validateProtocol({ protocolId });

    if (result.data && (result.data as Record<string, unknown>).valid) {
      const protocolData = (result.data as Record<string, unknown>).protocol as Record<string, unknown>;
      return {
        valid: true,
        metadata: {
          protocol_id: protocolData.protocol_id as string,
          version: protocolData.version as string,
          active_medications: protocolData.active_medications as string[],
        },
      };
    }

    return {
      valid: false,
      metadata: null,
      error: 'Protocol validation failed',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error during protocol validation';
    return {
      valid: false,
      metadata: null,
      error: errorMessage,
    };
  }
}
