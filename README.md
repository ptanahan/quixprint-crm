# Quixprint CRM — Company + Contacts

This version replaces the earlier lead-based CRM.

## Important

Because you have not imported any leads yet, use a new Supabase project and run the included SQL file once.

## Setup

1. Create a brand-new Supabase project.
2. Open **SQL Editor**.
3. Paste and run `supabase-company-contacts-setup.sql`.
4. In `config.js`, paste:
   - Supabase project URL
   - Publishable key
5. Replace the files in your GitHub CRM repository with all files from this folder.
6. Commit the changes.
7. Netlify will redeploy automatically.

## Import format

One row represents one contact. Repeated company names are grouped into one company.

Example:

```csv
company,contact_name,contact_title,contact_email
ABC Roofing,John Smith,Marketing Director,john@abc.com
ABC Roofing,Jane Doe,Purchasing Manager,jane@abc.com
```

The CRM creates:

- One company: ABC Roofing
- Two contacts attached to ABC Roofing
