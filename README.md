# Supabase File Manager

![License](https://img.shields.io/badge/license-MIT-blue)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-FFC131?style=flat&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)

A lightweight desktop app for managing Supabase Storage — built with Tauri + React. Designed for performance, security, and ease of use.

## ✨ Features

*   **📁 Full Folder Support**: Upload entire directory trees from your computer while preserving the folder structure.
*   **⚡ High Performance**: Parallelized operations (concurrency controlled) for lightning-fast batch uploads and recursive folder moves/renames.
*   **🛡️ Secure & Credential-Agnostic**: Keys are stored locally on your machine and never baked into the app.
*   **🗄️ Bucket Management**: Create, delete, and configure buckets directly. Toggle Public/Private access and set file size/MIME restrictions.
*   **🪄 Smart Placeholders**: Automatically manages `.keep` files to prevent empty folders from vanishing in Supabase, with an auto-cleanup system.
*   **📜 Policy Helper**: Integrated SQL generator to help you set up Row Level Security (RLS) in seconds.

---

## 🚀 Getting Started

When you first launch the app, you will be prompted to enter your:
1.  **Supabase Project URL**
2.  **Service Role Key** (Recommended for full admin control)

These credentials are saved securely in your local machine's `localStorage` and never sent to any third party.

---

## 🔒 Security & Key Choice

You can use two types of keys with this app:

### 1. Service Role Key (Admin Access)
*   **Recommended for personal use.**
*   Bypasses all RLS (Row Level Security) policies.
*   Required for full recursive operations (Rename/Move/Delete) and managing bucket settings.

### 2. Anon Key (Secure Sharing)
*   **Safe for multi-user environments.**
*   Respects RLS policies.
*   **Requires Setup**: You must use the **Policy Helper** in the app's bucket settings to copy and apply SQL policies to your Supabase Dashboard.

---

## 🛠️ Integrated Policy Helper

If you use the **Anon Key**, the app includes a "Policy Helper" in the Bucket Settings (**Gear Icon > Buckets > Edit**). This generates the exact SQL you need for:
*   Full Management Access
*   Public Read-Only Access
*   Authenticated Uploads

Simply copy the snippet and run it in your **Supabase SQL Editor**.

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

- `src/App.jsx`: Main UI, navigation, and state management.
- `src/storage.js`: Optimized wrapper for Supabase Storage API with worker pools.
- `src/supabase.js`: Dynamic client configuration.
- `src/styles.css`: Modern, dark-themed glassmorphism UI.
- `src-tauri/`: Rust backend and build configuration.

---

## 📄 License
MIT
