# DevOps ChatBot

An AI-powered DevOps assistant for repository management built with Next.js, TypeScript, and Tailwind CSS.

## Project Structure

```
devops-chatbot/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   └── chat/
│   │   ├── chat/
│   │   ├── login/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   ├── lib/
│   ├── types/
│   │   └── index.ts
│   └── __tests__/
│       └── types.test.ts
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── jest.config.js
└── package.json
```

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Authentication**: NextAuth.js v4
- **GitHub Integration**: @octokit/rest
- **UI Icons**: lucide-react
- **Date Handling**: date-fns
- **Testing**: Jest with TypeScript support

## Dependencies

### Runtime Dependencies
- next (latest)
- react (latest)
- react-dom (latest)
- next-auth (v4)
- @octokit/rest
- lucide-react
- date-fns
- uuid

### Development Dependencies
- TypeScript
- Tailwind CSS v4 with @tailwindcss/postcss
- ESLint with next/core-web-vitals config
- Jest with ts-jest
- @testing-library/react
- @testing-library/jest-dom
- @types/node, @types/react, @types/react-dom, @types/uuid

## TypeScript Interfaces

The project includes comprehensive TypeScript interfaces in [src/types/index.ts](src/types/index.ts):

- **Repository**: GitHub repository data structure
- **ChatMessage**: Chat message with role, content, and optional data payload
- **ChatSession**: Chat session with messages and metadata
- **UserProfile**: User profile with Okta groups support
- **AgentCommand**: Agent command intent and parameters

## Environment Variables

Configure the following variables in `.env.local`:

```env
OKTA_CLIENT_ID=your_okta_client_id
OKTA_CLIENT_SECRET=your_okta_client_secret
OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_min_32_chars_long
GITHUB_TOKEN=your_github_token
GITHUB_ORG=your-github-org
```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Update the values in `.env.local` with your actual credentials.

3. **Run development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```

6. **Start production server**:
   ```bash
   npm start
   ```

## Testing

The project includes comprehensive type validation tests that verify all TypeScript interfaces are properly exported and can be used to create valid typed objects. All tests are located in [src/__tests__/types.test.ts](src/__tests__/types.test.ts).

Run tests with:
```bash
npm test
```

## Features

- ✅ TypeScript strict mode enabled
- ✅ Tailwind CSS v4 for styling
- ✅ Next.js App Router with src/ directory structure
- ✅ NextAuth.js for Okta authentication
- ✅ GitHub API integration via Octokit
- ✅ Comprehensive TypeScript type definitions
- ✅ Jest testing setup with type validation tests
- ✅ ESLint configuration
- ✅ Responsive design ready

## Next Steps

1. Implement NextAuth configuration in `src/app/api/auth/[...nextauth]/route.ts`
2. Create chat interface components in `src/components/`
3. Implement GitHub API integration in `src/lib/`
4. Build chat API endpoints in `src/app/api/chat/`
5. Create login and chat pages

## License

ISC
