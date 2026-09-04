# Ma semaine chez Uniparco — guide de mise en ligne (100% gratuit)

## 1. Créer la base de données gratuite (Firebase)

1. Va sur https://console.firebase.google.com et connecte-toi avec un compte Google.
2. Clique **Ajouter un projet**, donne-lui un nom (ex: `uniparco-budget`), désactive Google Analytics (pas nécessaire), crée le projet.
3. Dans le menu de gauche : **Build > Firestore Database** > **Créer une base de données**.
   - Choisis une région proche (ex: `europe-west` ou `eur3`).
   - Démarre en **mode test** (les règles s'ajustent à l'étape 4).
4. Une fois créée, va dans l'onglet **Règles** et remplace le contenu par :
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /budgets/{docId} {
         allow read, write: if true;
       }
     }
   }
   ```
   Publie. (Note : ceci reste ouvert à quiconque connaît ton code d'accès exact — largement suffisant pour un usage perso, mais évite de partager ton code.)
5. Retourne dans **Paramètres du projet** (icône engrenage) > onglet **Général** > section **Vos applications** > clique l'icône **</>** (Web) > donne un nom > **Enregistrer l'application**.
6. Copie les valeurs affichées (`apiKey`, `authDomain`, `projectId`, etc.) et colle-les dans `src/firebase.js` à la place de `REMPLACE_MOI`.

## 2. Mettre le code sur GitHub

1. Crée un compte gratuit sur https://github.com si tu n'en as pas.
2. Crée un nouveau dépôt (repository), par exemple `uniparco-budget`.
3. Depuis ce dossier, exécute :
   ```
   git init
   git add .
   git commit -m "Première version"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/uniparco-budget.git
   git push -u origin main
   ```

## 3. Déployer gratuitement (Vercel)

1. Va sur https://vercel.com et connecte-toi avec ton compte GitHub (gratuit, pas de carte requise).
2. Clique **Add New > Project**, choisis ton dépôt `uniparco-budget`.
3. Vercel détecte automatiquement Vite — laisse les réglages par défaut, clique **Deploy**.
4. Après 1-2 minutes, tu obtiens une URL du type `uniparco-budget.vercel.app` — accessible depuis n'importe quel appareil, gratuitement, à vie (tant que l'usage reste dans le tier gratuit, largement suffisant pour un usage perso).

## 4. Utilisation sur plusieurs appareils

À la première ouverture, l'app te demande un **code d'accès** — invente-en un unique (ex: `pmg-uniparco-2026`) et utilise **exactement le même** sur ton téléphone et ton PC : c'est ce code qui relie les deux à la même donnée dans Firestore.

## En local (pour tester avant de déployer)

```
npm install
npm run dev
```
