# Quixprint CRM — Fresh Start

Use only this package. Ignore the two earlier CRM downloads.

## 1. Create a brand-new Supabase project

You do not need to delete the earlier project immediately. Creating a new one avoids mixing the earlier setup with this version.

## 2. Run the single SQL setup file

1. Open the new Supabase project.
2. Open **SQL Editor**.
3. Click **New query**.
4. Open `supabase-fresh-setup.sql` from this folder.
5. Copy and paste the entire file into Supabase.
6. Click **Run**.

## 3. Find your Supabase information

- Project ID: **Project Settings → General**
- Project URL: `https://YOUR_PROJECT_ID.supabase.co`
- Publishable key: **Project Settings → API Keys**

Do not use a secret key or service-role key.

## 4. Edit config.js

Paste the URL and publishable key into:

```javascript
window.QUIXPRINT_CRM_CONFIG = {
  SUPABASE_URL: "YOUR_SUPABASE_URL",
  SUPABASE_ANON_KEY: "YOUR_PUBLISHABLE_ANON_KEY"
};
```

## 5. Upload to GitHub and deploy

1. Create a new GitHub repository named `quixprint-crm`.
2. Upload all files from this folder.
3. In Netlify, choose **Add new site → Import an existing project**.
4. Choose the GitHub repository.
5. Leave the build command blank.
6. Publish from the repository root.

## 6. Add the second user

1. Create your account first.
2. Open **Settings** in the CRM.
3. Copy the workspace invite code.
4. The second user creates an account and enters that code.

Both users will share the same leads and activity history.
