import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();

interface ProtocolValidationRequest {
  protocolId: string;
  practiceOdsCode?: string;
}

interface ProtocolData {
  protocol_id: string;
  version: string;
  name: string;
  description: string;
  active_medications: string[];
  is_active: boolean;
}

interface ProtocolValidationResponse {
  valid: boolean;
  protocol: ProtocolData | null;
  error?: string;
  lastUsedAt?: FieldValue;
}

/**
 * Validates protocol access and retrieves protocol data
 * Called from React app via httpsCallable
 */
export const validateProtocol = onCall(
  { region: 'europe-west2', maxInstances: 100 },
  async (request): Promise<ProtocolValidationResponse> => {
    const { protocolId, practiceOdsCode } = request.data as ProtocolValidationRequest;

    // Validate input
    if (!protocolId || typeof protocolId !== 'string') {
      throw new HttpsError('invalid-argument', 'Protocol ID is required and must be a string');
    }

    try {
      // Query the protocols collection for the requested protocol
      const protocolDoc = await db.collection('protocols').doc(protocolId).get();

      if (!protocolDoc.exists) {
        throw new HttpsError('not-found', `Protocol ${protocolId} not found`);
      }

      const protocolData = protocolDoc.data();

      // Verify protocol is active
      if (!protocolData?.is_active) {
        throw new HttpsError('unavailable', `Protocol ${protocolId} is not active`);
      }

      // Update last_used_at timestamp
      await protocolDoc.ref.update({
        last_used_at: Timestamp.now(),
      });

      // Return protocol data
      return {
        valid: true,
        protocol: {
          protocol_id: protocolData.protocol_id,
          version: protocolData.version,
          name: protocolData.name,
          description: protocolData.description,
          active_medications: protocolData.active_medications || [],
          is_active: protocolData.is_active,
        },
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error('Unexpected error validating protocol:', error);
      throw new HttpsError('internal', 'An unexpected error occurred while validating the protocol');
    }
  }
);

/**
 * Health check endpoint
 */
export const healthCheck = onCall({ region: 'europe-west2' }, async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});
