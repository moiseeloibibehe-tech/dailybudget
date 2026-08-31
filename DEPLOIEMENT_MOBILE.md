# Déployer DailyBudget depuis ton téléphone

Ce projet est une **PWA** (Progressive Web App) : une fois déployée sur Vercel, tu pourras l'installer sur l'écran d'accueil de ton iPhone ou Android, elle s'ouvrira comme une vraie app (plein écran, icône, hors-ligne).

## 1. Créer le dépôt GitHub (depuis le navigateur mobile)

1. Va sur github.com → **New repository**
2. Nomme-le `dailybudget`, laisse-le public ou privé, ne coche rien d'autre
3. Crée le dépôt

## 2. Uploader les fichiers (même méthode que pour SohanCRM)

Sur la page du dépôt vide → **uploading an existing file**, puis envoie les fichiers **dossier par dossier** :

- Racine : `package.json`, `vite.config.js`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`, `.env.example`
- Crée le dossier `src/` en uploadant `src/main.jsx`, `src/App.jsx`, `src/index.css` (tape `src/main.jsx` comme nom de fichier lors de l'upload, GitHub crée le dossier automatiquement)
- Crée `src/lib/supabase.js`
- Crée `src/services/transactions.js`
- Crée `src/components/AuthScreen.jsx`
- Crée le dossier `public/` avec `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`
- Crée le dossier `supabase/` avec `supabase/schema.sql` (utile pour garder une trace, pas utilisé au build)

Valide chaque upload avec **Commit changes**.

## 3. Créer le projet Supabase

1. Sur supabase.com → **New project** (choisis un nom, un mot de passe DB, une région proche)
2. Une fois le projet prêt : menu **SQL Editor** → colle le contenu de `supabase/schema.sql` → **Run**
   - Ça crée la table `transactions`, la table `settings` (budget mensuel), et les règles de sécurité (chacun ne voit que ses propres données)
3. Menu **Authentication → Providers** : vérifie que **Email** est activé (c'est le cas par défaut). Pas besoin de mot de passe : l'app utilise un lien magique envoyé par e-mail.
4. Menu **Project Settings → API** : note les deux valeurs :
   - `Project URL` → deviendra `VITE_SUPABASE_URL`
   - `anon public` key → deviendra `VITE_SUPABASE_ANON_KEY`

Ce sont exactement les mêmes deux variables que celles utilisées pour SohanCRM.

## 4. Connecter à Vercel

1. Sur vercel.com → **Add New Project**
2. Importe le dépôt `dailybudget`
3. Framework Preset : **Vite** (détecté automatiquement)
4. Avant de déployer, ouvre **Environment Variables** et ajoute :
   - `VITE_SUPABASE_URL` = ton Project URL
   - `VITE_SUPABASE_ANON_KEY` = ta clé anon public
5. Déployer

Chaque futur commit depuis GitHub redéploiera automatiquement, exactement comme pour SohanCRM.

## 5. Autoriser l'URL Vercel dans Supabase

Menu **Authentication → URL Configuration** dans Supabase → ajoute ton URL Vercel (ex. `https://dailybudget.vercel.app`) dans **Redirect URLs**, sinon le lien magique ne pourra pas te reconnecter à l'app.

## 6. Se connecter et installer l'app sur ton téléphone

Une fois l'URL Vercel active (ex. `dailybudget.vercel.app`) :

1. Ouvre le lien, entre ton e-mail, ouvre l'e-mail reçu et appuie sur le lien de connexion
2. **iPhone (Safari)** : bouton Partager → **Sur l'écran d'accueil**
3. **Android (Chrome)** : menu ⋮ → **Installer l'application**

L'icône DailyBudget apparaît comme une vraie app. Connecte-toi avec le même e-mail sur un autre appareil et tes transactions apparaissent automatiquement (synchronisation en temps réel via Supabase).

## Notes

- Le budget mensuel par défaut est 300 000 F, stocké dans la table `settings` (modifiable plus tard depuis un écran de réglages).
- Les transactions se synchronisent en temps réel entre appareils connectés au même compte.
- Chaque utilisateur ne voit que ses propres données grâce aux règles de sécurité (RLS) définies dans `supabase/schema.sql`.
