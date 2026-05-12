import { useState } from 'react'
import { Octokit } from '@octokit/rest'
import { APP_META_PATH, DATA_REPO, repoDescription } from './githubStorage'
import './onboarding.css'

export default function Onboarding({ token, user, onComplete }) {
  const [step, setStep]       = useState(1)    // 1 data repo | 2 GM question | 4 done
  const [isGM, setIsGM]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const octokit = new Octokit({ auth: token })

  // ── Step 1: Create ttrpg-app-data ──
  const createDataRepo = async () => {
    setLoading(true)
    setError(null)
    try {
      await octokit.repos.createForAuthenticatedUser({
        name:        DATA_REPO,
        description: repoDescription(),
        auto_init:   true,
        private:     false,
      })
      setStep(2)
    } catch (err) {
      // Repo might already exist (422) — treat as success
      if (err.status === 422) {
        setStep(2)
      } else {
        setError(err.message)
      }
    }
    setLoading(false)
  }

  const saveAppMeta = async (gmStatus) => {
    setLoading(true)
    setError(null)
    try {
      let sha
      try {
        const { data } = await octokit.repos.getContent({
          owner: user.login,
          repo: DATA_REPO,
          path: APP_META_PATH,
        })
        sha = data.sha
      } catch { /* first metadata write */ }

      await octokit.repos.createOrUpdateFileContents({
        owner: user.login,
        repo: DATA_REPO,
        path: APP_META_PATH,
        message: gmStatus ? 'Enable GM tools' : 'Finish app setup',
        content: btoa(unescape(encodeURIComponent(JSON.stringify({
          isGM: gmStatus,
          updatedAt: new Date().toISOString(),
        }, null, 2)))),
        ...(sha ? { sha } : {}),
      })
      setStep(4)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const finish = () => {
    onComplete(isGM)
  }

  // ════════════════════════════════════════
  //  Step 1 — Create character repo
  // ════════════════════════════════════════
  if (step === 1) return (
    <div className="ob-body">
      <div className="ob-panel">
        <div className="ob-logo"><img src="/uploads/placeholders/default-portrait.jpg" alt="" /></div>
        <h1 className="ob-title">Welcome, {user.login}!</h1>
        <p className="ob-body-text">
          First, let's create your app data repository. This is where your characters
          and campaigns will be stored — in your own GitHub account. Always yours.
        </p>

        <div className="ob-repo-pill">
          <span className="ob-repo-icon">Repo</span>
          <span className="ob-repo-name">{DATA_REPO}</span>
        </div>

        {error && <p className="ob-error">{error}</p>}

        <button
          className="ob-btn ob-btn--accent"
          onClick={createDataRepo}
          disabled={loading}
        >
          {loading ? 'Creating…' : 'Create My Repository'}
        </button>
      </div>
    </div>
  )

  // ════════════════════════════════════════
  //  Step 2 — GM question
  // ════════════════════════════════════════
  if (step === 2) return (
    <div className="ob-body">
      <div className="ob-panel">
        <div className="ob-logo"><img src="/uploads/placeholders/default-portrait.jpg" alt="" /></div>
        <h1 className="ob-title">One quick question…</h1>
        <p className="ob-body-text">
          Do you ever run games as a Game Master?
        </p>
        <p className="ob-hint">You can change this any time in settings.</p>

        <div className="ob-choice-grid">
          <button
            className="ob-choice-btn"
            onClick={() => { setIsGM(true); saveAppMeta(true) }}
            disabled={loading}
          >
            <span className="ob-choice-emoji">GM</span>
            <span className="ob-choice-label">Yes, I'm a GM</span>
          </button>
          <button
            className="ob-choice-btn"
            onClick={() => { setIsGM(false); saveAppMeta(false) }}
            disabled={loading}
          >
            <span className="ob-choice-emoji">PC</span>
            <span className="ob-choice-label">No, just a player</span>
          </button>
        </div>
      </div>
    </div>
  )

  // ════════════════════════════════════════
  //  Step 4 — Done
  // ════════════════════════════════════════
  if (step === 4) return (
    <div className={`ob-body${isGM ? ' ob-body--dm' : ''}`}>
      <div className={`ob-panel${isGM ? ' ob-panel--dm' : ''}`}>
        <div className="ob-logo"><img src="/uploads/placeholders/default-portrait.jpg" alt="" /></div>
        <h1 className="ob-title">{isGM ? 'GM All Set!' : 'All set!'}</h1>
        <p className="ob-body-text">
          {isGM
            ? 'Your character and campaign repositories are ready. Time to start your adventure.'
            : 'Your app data repository is ready. Time to create your first character!'
          }
        </p>

        {isGM && (
          <div className="ob-share-box">
            <div className="ob-share-label">Your app data repo:</div>
            <div className="ob-share-url">github.com/{user.login}/{DATA_REPO}</div>
          </div>
        )}

        <button className={`ob-btn${isGM ? ' ob-btn--dm' : ' ob-btn--accent'}`} onClick={finish}>
          {isGM ? "Let's run a game →" : "Let's go →"}
        </button>
      </div>
    </div>
  )
}
