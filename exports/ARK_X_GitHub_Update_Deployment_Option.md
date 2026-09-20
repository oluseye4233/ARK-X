# ARK-X GitHub Update Deployment Option

## Updating Atanda.ai through the existing ARK-X repository

**Prepared for:** ATANDA / ARK Platform  
**Prepared:** 5 September 2026  
**Purpose:** Provide a controlled approach for replacing the current Atanda.ai application with the latest ARK project by updating the existing ARK-X GitHub repository.

---

## 1. Recommended option

The preferred approach is to push the latest ARK project code from the current development workspace into the **ARK-X GitHub repository**, then allow Hostinger to build and deploy the selected production branch.

This is safer and easier to maintain than manually uploading application files through Hostinger's file manager.

```text
Latest ARK project
        ↓
Staging branch in ARK-X
        ↓
Review and merge into production branch
        ↓
Hostinger pulls the repository
        ↓
npm ci
        ↓
npm run build
        ↓
npm start
        ↓
Updated application served at Atanda.ai
```

## 2. Why this option is preferable

- GitHub provides a complete history of every change.
- A pull request can be reviewed before production is updated.
- Hostinger can rebuild automatically after an approved merge.
- A previous version can be restored if the deployment fails.
- Future ARK updates can follow the same repeatable process.
- Secrets remain in Hostinger rather than being included in the code.
- Manual file-transfer mistakes are avoided.

## 3. What the update includes

Updating the repository transfers the application source, including:

- React and Vite frontend
- Node.js and Express backend
- Shared schemas and application models
- Database migration files
- ARK scoring and assessment logic
- ARK Guide and report functionality
- MERLIN completion guidance
- Marketplace, learning, workforce, and administration surfaces
- Build and production-start scripts

## 4. What a GitHub push does not transfer

A source-code update does **not** automatically transfer or configure:

- Production PostgreSQL data
- Hostinger environment variables
- API keys or credentials
- Session secrets
- User-uploaded files stored outside Git
- DNS records
- SSL configuration
- Replit-managed Gmail or AI connections

These items must be checked separately before Atanda.ai is switched to the new build.

## 5. Hostinger prerequisites

The Hostinger account must support a full Node.js Web App or VPS deployment. Static or PHP-only hosting cannot run this application as-is.

Recommended configuration:

| Setting | Recommended value |
|---|---|
| Source | Private ARK-X GitHub repository |
| Production branch | `main`, or the existing Hostinger production branch |
| Node.js | Version 20 or 22 |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Start command | `npm start` |
| Runtime mode | Production |
| Database | PostgreSQL |
| SSL | Enabled for `atanda.ai` and `www.atanda.ai` |

## 6. Safe update procedure

### Phase 1 — Protect the current site

1. Back up the current Atanda.ai website.
2. Back up the production database.
3. Record the current domain and DNS configuration.
4. Confirm how to restore the previous Hostinger deployment.
5. Do not delete the existing site during preparation.

### Phase 2 — Confirm the repository connection

In Hostinger, confirm:

- The application is connected to the correct ARK-X repository.
- Hostinger has access to the private repository.
- The selected production branch is known.
- Automatic deployments are either enabled or a manual redeploy option is available.
- Build and start commands match the values in this guide.

### Phase 3 — Push to a staging branch

Create a dedicated branch instead of immediately replacing production:

```bash
git checkout -b replit-production-sync
git add .
git commit -m "Sync latest ARK platform"
git push origin replit-production-sync
```

Before pushing, confirm that no secret files are staged:

```bash
git status
git diff --cached
```

Never commit `.env` files, database connection strings, API keys, access tokens, session secrets, or exported production data.

### Phase 4 — Review and merge

1. Open a GitHub pull request from `replit-production-sync` to the production branch.
2. Review the full file change.
3. Run the project checks.
4. Confirm database migrations are included.
5. Confirm no secret or temporary files are present.
6. Merge only after the review passes.

Recommended checks:

```bash
npm ci
npm run check
npm test
npm run build
```

### Phase 5 — Deploy on Hostinger

After the merge:

1. Allow Hostinger's automatic deployment to start, or select **Redeploy**.
2. Monitor the installation and build logs.
3. Confirm that the production process starts with `npm start`.
4. Confirm that Hostinger supplies the application port.
5. Review runtime logs for database, migration, AI, and email errors.

## 7. Production environment configuration

The Hostinger environment must contain, at minimum:

```text
NODE_ENV=production
DATABASE_URL
SESSION_SECRET
```

Depending on enabled features, it may also require configuration for:

- OpenAI, Anthropic, or Gemini
- ATANDA Command Centre
- Administrative access
- HR integrations
- Outbound transactional email

Secret values must be entered directly in Hostinger's protected environment settings. They must not be placed in GitHub or included in this document.

## 8. Database protection

ARK uses PostgreSQL. The existing production database should not be replaced or converted casually.

Before deployment:

1. Confirm which database the current Atanda.ai application uses.
2. Create a restorable backup.
3. Confirm the new Hostinger build uses the intended `DATABASE_URL`.
4. Confirm the database user has the required permissions.
5. Allow the application to apply tracked migrations.
6. Verify that existing users and ARK records remain available.

If the new build connects to a new or empty database, the website may appear functional while existing user accounts and assessments are missing.

## 9. Replit integration compatibility

The current project includes integrations originally configured in Replit.

### Gmail

Replit's Gmail connector is not automatically available on Hostinger. Transactional email should be tested before launch. A portable provider may be required, such as:

- Google Workspace SMTP or OAuth
- Resend
- Postmark
- SendGrid
- Amazon SES

### AI providers

Replit-managed AI credentials and base URLs may not be portable. Hostinger may require direct provider credentials and standard provider endpoints.

The application should not be considered ready for the domain switch until its AI and email operations have been tested from the Hostinger runtime.

## 10. Acceptance test

Test the Hostinger deployment on a temporary URL before changing Atanda.ai.

### Public experience

- Landing page loads correctly.
- Sign-up, login, and password recovery work.
- Demo tour works without authentication.
- Privacy and terms pages load.
- Mobile and desktop layouts are readable.
- `robots.txt` and `sitemap.xml` return the expected formats.

### Authenticated experience

- A user can sign in and remain signed in after refresh.
- CV upload and assessment complete successfully.
- Intelligence Hub displays the expected data.
- MERLIN loads current progress and recommendations.
- ARK Guide and reports render correctly.
- Subscription and profile pages work.

### Platform services

- Database changes persist after an application restart.
- AI requests succeed.
- Confirmation and notification emails are delivered.
- Shared-report links work.
- Administrative and workforce routes remain access-controlled.
- No secrets appear in browser or server logs.

## 11. Domain cutover

Only connect Atanda.ai after the temporary deployment passes the acceptance test.

1. Add `atanda.ai` and `www.atanda.ai` to the Hostinger application.
2. Apply Hostinger's required DNS records.
3. Enable SSL.
4. Select one canonical hostname.
5. Redirect the other hostname to the canonical hostname.
6. Monitor application logs during and after DNS propagation.
7. Preserve the previous deployment until the new site has remained stable.

Recommended canonical pattern:

```text
https://www.atanda.ai → https://atanda.ai
```

## 12. Rollback plan

If the deployment fails:

1. Stop the new Hostinger deployment from receiving production traffic.
2. Restore the previous successful application build.
3. Restore the previous DNS configuration if necessary.
4. Restore the database only if a migration caused a confirmed data problem.
5. Review Hostinger build and runtime logs.
6. Correct the issue in a new GitHub branch.
7. Repeat staging validation before another production merge.

Do not attempt to fix a broken production deployment by making unreviewed changes directly on the server.

## 13. Recommended operational workflow

Use the following process for future releases:

```text
Develop and verify
        ↓
Push feature or release branch
        ↓
Open pull request
        ↓
Run type checking, tests, and production build
        ↓
Review and approve
        ↓
Merge into production branch
        ↓
Hostinger deploys
        ↓
Run production smoke test
```

## 14. Final recommendation

Updating the ARK-X GitHub repository is the best deployment route when Hostinger is already connected to that repository.

Proceed only after confirming:

- A current website and database backup exists.
- Hostinger is connected to the correct repository and branch.
- The build and start commands are correct.
- Production PostgreSQL configuration is preserved.
- Required environment variables are configured.
- Replit-specific Gmail and AI dependencies have been replaced or proven to work.
- The new build passes testing on a temporary Hostinger URL.
- A rollback path remains available.

The GitHub update should be treated as a controlled production release—not simply as a file upload.