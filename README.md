# Supabase File Manager

![License](https://img.shields.io/badge/license-MIT-blue)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-FFC131?style=flat&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)

A lightweight desktop app for managing Supabase Storage — built with Tauri + React.

## 🚀 Getting Started

Unlike many storage managers, this app **does not bake your secret keys into the executable**. 

When you first launch the app, you will be prompted to enter your:
1. **Supabase Project URL**
2. **Service Role Key** (or Anon Key)

These credentials are saved securely in your local machine's storage and never sent to any third party.

---

## 🔒 Security & Key Choice

You can use two types of keys with this app:

### 1. Service Role Key (Admin Access)
*   **Recommended for personal use.**
*   Bypasses all RLS (Row Level Security) policies.
*   Required for full recursive folder operations (Rename/Move/Delete) unless you have very broad RLS policies.
*   **Warning**: Never share an `.exe` built with this key baked in (our app avoids this by asking for the key at runtime).

### 2. Anon Key (Secure Sharing)
*   **Safe for multi-user environments.**
*   Respects RLS policies.
*   **Requires Setup**: You must configure Storage Policies in your Supabase Dashboard for the app to work.

---

## 🛠️ Supabase RLS Setup (For Anon Key)

If you choose to use the **Anon Key**, you must add these policies in your Supabase Dashboard (**Storage > Policies**) for the buckets you want to manage:

### Full Management Access (SQL)
Run this in your Supabase SQL Editor to allow the Anon key to fully manage a specific bucket:

```sql
-- 1. Allow viewing files and folders
create policy "Allow Select" on storage.objects for select
using ( bucket_id = 'your-bucket-name' );

-- 2. Allow uploading and creating folders
create policy "Allow Insert" on storage.objects for insert
with check ( bucket_id = 'your-bucket-name' );

-- 3. Allow renaming and moving
create policy "Allow Update" on storage.objects for update
using ( bucket_id = 'your-bucket-name' );

-- 4. Allow deleting
create policy "Allow Delete" on storage.objects for delete
using ( bucket_id = 'your-bucket-name' );
```

---

## 🛠️ Development

### Prerequisites
- **Rust**: [rustup.rs](https://rustup.rs/)
- **Node.js**: [nodejs.org](https://nodejs.org/) (v18+)
- **System Deps**: See [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

### Commands
```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build the production installer (.exe, .msi, etc.)
npm run tauri build
```

---

## 📁 Project Structure

- `src/App.jsx`: Main UI and navigation logic.
- `src/storage.js`: Wrapper for Supabase Storage API.
- `src/supabase.js`: Dynamic client configuration.
- `src-tauri/`: Rust backend and build configuration.

---

## 📄 License
MIT
