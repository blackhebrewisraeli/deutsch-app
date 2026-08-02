# Professional GitHub + LinkedIn presence kit

Ready-to-apply artifacts from the **Professional GitHub + LinkedIn Presence Plan**.

This folder lives in the private `deutsch-app` repo only as a staging/apply kit. The public surfaces it updates are:

| Surface | Role |
|:--------|:-----|
| [`blackhebrewisraeli/blackhebrewisraeli`](https://github.com/blackhebrewisraeli) | **Landing page** (profile README) |
| [`blackhebrewisraeli/github-skills-journey`](https://github.com/blackhebrewisraeli/github-skills-journey) | Featured Foundations proof module |
| LinkedIn | Paste kit in [`LINKEDIN_KIT.md`](./LINKEDIN_KIT.md) |

## What’s included

```
docs/professional-presence/
├── README.md                 ← you are here
├── LINKEDIN_KIT.md           ← paste-ready LinkedIn copy
├── profile-repo/
│   ├── README.md             ← new profile landing README
│   └── .github/workflows/metrics.yml
├── skills-journey/
│   ├── README.md             ← recruiter skim + progress dashboard
│   └── ROADMAP.md            ← trimmed personal study log
└── scripts/
    ├── apply.sh              ← archive skills-* + push READMEs
    ├── verify.sh             ← public hygiene checks
    └── lib_put_file.py
```

## Apply (recommended)

### Option A — GitHub Actions (from this private repo)

1. Create a PAT (classic `repo`, or fine-grained with Contents + Administration on the profile/journey repos and Administration on `skills-*`).
2. Add it as repository secret **`PRO_PRESENCE_PAT`** on `deutsch-app`.
3. Actions → **Apply professional presence kit** → Run workflow.
4. Pin the 6 portfolio repos (see below).
5. Add **`METRICS_TOKEN`** on the profile repo and run **GitHub Metrics**.
6. Paste [`LINKEDIN_KIT.md`](./LINKEDIN_KIT.md) into LinkedIn.

### Option B — Local script

```bash
export GH_TOKEN=ghp_xxx   # your PAT
chmod +x docs/professional-presence/scripts/*.sh
./docs/professional-presence/scripts/apply.sh
./docs/professional-presence/scripts/verify.sh
```

Dry run:

```bash
DRY_RUN=1 ./docs/professional-presence/scripts/apply.sh
```

## Pin set (6)

Customize pins on https://github.com/blackhebrewisraeli → **Customize your pins**:

1. `github-skills-journey`
2. `C-Assembler-Simulator`
3. `Transportation-system-project`
4. `ebpf-bcc-tracing-lab`
5. `Python-SQL-Bank-Account-Database`
6. `Java-sorting-searching-templates`

## Privacy rules baked in

- No public email or phone on GitHub/LinkedIn About
- Contact = LinkedIn message or GitHub issue form
- `skills-*` exercise repos stay **public** (proof links) but get **archived** (profile noise down)
- Under-development work (e.g. `deutsch-app`) stays **private** and unmentioned until demo-ready
- Instagram removed from the profile primary CTA

## Metrics dashboard

[`profile-repo/.github/workflows/metrics.yml`](./profile-repo/.github/workflows/metrics.yml) uses [lowlighter/metrics](https://github.com/lowlighter/metrics):

- isometric commit calendar
- languages
- featured repositories
- coding habits

After the first successful run, `github-metrics.svg` appears in the profile repo and renders in the README.
