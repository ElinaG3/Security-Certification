# 🔐 CompTIA Security+ Exam Prep System
# CompTIA Security+ Exam Prep is LIVE on : https://certificationprep.netlify.app

Complete, interactive exam prep with:
- **📚 Learning Path**: Deep concept understanding with visuals (official exam blueprint)
- **❓ Practice Questions**: 135+ exam-style questions with goal tracking (85% target)
- **📊 Progress Tracking**: Real-time dashboard with weak spot detection

## Features

✅ **5 Exam Domains** with correct percentages:
- General Security Concepts (12%)
- Threats, Vulnerabilities, & Mitigations (22%)
- Security Architecture (18%)
- Security Operations (28%)
- Security Program Management (20%)

✅ **ADHD-Optimized**:
- Chunked learning (no walls of text)
- Visual diagrams and explanations
- Immediate feedback
- Progress tracking

✅ **3-Week Goal System**:
- Set custom deadline and target accuracy
- Real-time progress tracking
- Days remaining countdown
- Weak spot identification

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/ElinaG3/security-plus-exam-prep.git
cd security-plus-exam-prep
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Locally
```bash
npm run dev
```
Then open: `http://localhost:5173`

## Deployment Options

### Option A: Vercel (EASIEST - Recommended)

1. Sign up at [vercel.com](https://vercel.com)
2. Click "New Project"
3. Connect your GitHub repo
4. Click "Deploy" (takes 30 seconds)
5. Get your live URL! Share it anywhere.

**Your app will be live instantly at: `https://your-app-name.vercel.app`**

### Option B: Netlify

1. Sign up at [netlify.com](https://netlify.com)
2. Click "Add new site" → "Connect to Git"
3. Select your GitHub repo
4. Click "Deploy"
5. Get your live URL!

**Your app will be live at: `https://certificationprep.netlify.app/**

### Option C: GitHub Pages

1. In your repo settings, go to "Pages"
2. Under "Build and deployment", select "GitHub Actions"
3. Copy this workflow file to `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist
```

4. Then deploy to Pages by pushing to `main`

## How to Use

### Learning Path
1. Select a domain (e.g., "Security Operations")
2. Choose a topic (e.g., "Identity & Access Management")
3. Learn each concept with:
   - Visual diagrams
   - Clear explanations
   - Real-world examples
   - Related concepts
4. Mark concepts as "Mastered"

### Practice Questions
1. Set a 3-week goal (deadline + target accuracy)
2. Select topics to practice
3. Answer questions and get immediate feedback
4. Dashboard shows:
   - Days remaining
   - Questions completed
   - Current accuracy vs target
   - Weak topics to review

### Study Strategy
**Week 1**: Learn → Test
- 2-3 concepts/day in Learning Path (20 min)
- Then 4-6 practice questions (15 min)

**Week 2**: Reinforce → Learn More
- Review weak topics (10 min)
- Test those topics (10 min)
- Learn new topics (15 min)

**Week 3**: Full Strength
- Heavy practice (50+ questions)
- Weak spot review
- Target 85%+ accuracy

## Technologies

- React 18
- Vite (fast build tool)
- Recharts (progress visualizations)
- Pure CSS (no external styling libraries)

## File Structure

```
├── index.html          # HTML entry point
├── package.json        # Dependencies & scripts
├── vite.config.js      # Vite configuration
├── .gitignore          # Git ignore rules
├── main.jsx            # React entry point
├── src/
│   ├── App.jsx         # Main app (menu + routing)
│   └── components/
│       ├── SecurityPlusLearning.jsx  # Learning path
│       └── SecurityPlusPrep.jsx      # Practice questions
└── public/
    └── (assets if needed)
```

## Exam Info

- **Exam**: CompTIA Security+ (SY0-701 v7)
- **Questions**: 90 questions
- **Time**: 90 minutes
- **Passing Score**: 750/900 (~83%)
- **Cost**: ~$370 USD
- **Renewal**: Every 3 years

## Tips for Success

✅ Use Learning Path FIRST to understand concepts
✅ Set a realistic 3-week goal with deadline
✅ Do 4-6 practice questions daily
✅ Review weak topics immediately
✅ Aim for 85%+ accuracy before exam
✅ Take full 50-question practice tests in final week

## Contributing

Found a bug or want to add content? Open an issue or submit a PR!

## License

MIT - Use freely for personal study

## Support

Questions? Contact: [Your email or GitHub issues]

---

**Good luck on your Security+ exam! 🚀**

Remember: Understanding concepts (Learning) + Testing knowledge (Practice) = Success
