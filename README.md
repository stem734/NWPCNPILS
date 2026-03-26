# NWPCNPILS - Patient Medication Information Portal

A React + TypeScript application for delivering medication information to patients via SystmOne integration.

## Overview

This is a patient-facing medication information portal integrated with NHS SystmOne. GPs can generate protocol strings with medication codes, which patients access via QR codes or direct links. The portal displays tailored medication information based on the codes provided.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite (hosted on Vercel)
- **Backend**: Firebase Cloud Functions (protocol validation)
- **Database**: Firestore (protocol definitions)
- **Integration**: SystmOne text variable passing medication codes via URL parameters

## Getting Started

### Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Vercel account (for deployment)

### Installation

1. Install dependencies:
```bash
npm install
cd functions && npm install && cd ..
```

2. Copy environment template:
```bash
cp .env.example .env.local
```

3. Add your Firebase config to `.env.local` (get from Firebase Console)

### Development

Start the dev server:
```bash
npm run dev
```

Visit `http://localhost:5173` and use the Clinician Demo button to test different scenarios.

### Building for Production

```bash
npm run build
```

## Firebase Setup

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for detailed Cloud Functions deployment instructions.

**Quick summary:**
1. Install Firebase CLI
2. Run `firebase deploy --only functions`
3. Add Firebase config to `.env.local`

## URL Parameters

### Single Medication
```
?code=101
```

### Multiple Medications
```
?code=101????301??
```
(The regex `/[1-5]0[12]/g` extracts codes from placeholder-filled strings)

### With Protocol Validation
```
?meta=base64EncodedProtocolMetadata
```

## Medication Codes

Current codes defined:
- **101**: Sulfonylurea - Starting Treatment
- **102**: Sulfonylurea - Reauthorisation
- **201**: SGLT2 Inhibitor - First Initiation
- **202**: SGLT2 Inhibitor - Reauthorisation
- **301**: Emollients and Skin Care
- **401**: Insulin Therapy
- **501**: Mounjaro (Tirzepatide)

## Project Structure

```
├── src/
│   ├── App.tsx              # Main app component
│   ├── firebase.ts          # Firebase SDK initialization
│   ├── protocolService.ts   # Protocol validation helpers
│   ├── App.css              # Component styles
│   └── index.css            # Global styles
├── functions/
│   ├── src/
│   │   └── index.ts         # Cloud Function code
│   ├── package.json
│   └── tsconfig.json
├── firebase.json            # Firebase configuration
└── .firebaserc              # Firebase project alias
```

## Deployment

### Vercel (React Frontend)

1. Connect your GitHub repo to Vercel
2. Set environment variables from `.env.local`
3. Deploy

The build command is:
```bash
npm run build
```

### Firebase (Cloud Functions)

Deploy functions:
```bash
firebase deploy --only functions
```

## Testing

Use the Clinician Demo button (bottom right) to:
- Test individual medication codes
- Test multi-medication scenarios
- Verify protocol validation flow

## Security

- Firestore security rules prevent direct database reads
- All protocol validation happens server-side via Cloud Functions
- Firebase SDK validates with environment variables (never exposed to client)

## Support

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for troubleshooting and monitoring.
