import { useState } from 'react'
import { Octokit } from '@octokit/rest'
import './onboarding.css'

const CHARACTERS_REPO = 'ttrpg-characters'
const CAMPAIGNS_REPO  = 'ttrpg-campaigns'

export default function Onboarding({ token, user, onComplete }) {
  const [step, setStep]       = useState(1)    // 1 char repo | 2 GM question | 3 campaigns repo | 4 done
  const [isGM, setIsGM]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const octokit = new Octokit({ auth: token })

  // ── Step 1: Create ttrpg-characters ──
  const createCharacterRepo = async () => {
    setLoading(true)
    setError(null)
    try {
      await octokit.repos.createForAuthenticatedUser({
        name:        CHARACTERS_REPO,
        description: 'My TTRPG characters — managed by TTRPG Sheet',
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

  // ── Step 3: Create ttrpg-campaigns ──
  const createCampaignsRepo = async () => {
    setLoading(true)
    setError(null)
    try {
      await octokit.repos.createForAuthenticatedUser({
        name:        CAMPAIGNS_REPO,
        description: 'TTRPG campaign data — managed by TTRPG Sheet',
        auto_init:   true,
        private:     false,
      })
      setStep(4)
    } catch (err) {
      if (err.status === 422) {
        setStep(4)
      } else {
        setError(err.message)
      }
    }
    setLoading(false)
  }

  const skipCampaigns = () => {
    setStep(4)
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
        <div className="ob-logo">⚔️</div>
        <h1 className="ob-title">Welcome, {user.login}!</h1>
        <p className="ob-body-text">
          First, let's create your character repository. This is where all your characters
          will be stored — in your own GitHub account. Always yours.
        </p>

        <div className="ob-repo-pill">
          <span className="ob-repo-icon">📁</span>
          <span className="ob-repo-name">{CHARACTERS_REPO}</span>
        </div>

        {error && <p className="ob-error">{error}</p>}

        <button
          className="ob-btn ob-btn--accent"
          onClick={createCharacterRepo}
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
        <div className="ob-logo">🎲</div>
        <h1 className="ob-title">One quick question…</h1>
        <p className="ob-body-text">
          Do you ever run games as a Game Master?
        </p>
        <p className="ob-hint">You can change this any time in settings.</p>

        <div className="ob-choice-grid">
          <button
            className="ob-choice-btn"
            onClick={() => { setIsGM(true); setStep(3) }}
          >
            <span className="ob-choice-emoji">📖</span>
            <span className="ob-choice-label">Yes, I'm a GM</span>
          </button>
          <button
            className="ob-choice-btn"
            onClick={() => { setIsGM(false); setStep(4) }}
          >
            <span className="ob-choice-emoji">⚔️</span>
            <span className="ob-choice-label">No, just a player</span>
          </button>
        </div>
      </div>
    </div>
  )

  // ════════════════════════════════════════
  //  Step 3 — Create campaigns repo (GM only)
  // ════════════════════════════════════════
  if (step === 3) return (
    <div className="ob-body ob-body--dm">
      <div className="ob-panel ob-panel--dm">
        <div className="ob-logo">📖</div>
        <h1 className="ob-title">Set up your Campaign Repository</h1>
        <p className="ob-body-text">
          A dedicated space for your campaigns, sessions, party data, and notes.
          Stored in your own GitHub account.
        </p>

        <div className="ob-repo-pill ob-repo-pill--dm">
          <span className="ob-repo-icon">📁</span>
          <span className="ob-repo-name">{CAMPAIGNS_REPO}</span>
        </div>

        {error && <p className="ob-error">{error}</p>}

        <button
          className="ob-btn ob-btn--dm"
          onClick={createCampaignsRepo}
          disabled={loading}
        >
          {loading ? 'Creating…' : 'Create Campaign Repository'}
        </button>

        <button
          className="ob-btn ob-btn--ghost"
          onClick={skipCampaigns}
          disabled={loading}
        >
          Skip for now
        </button>
      </div>
    </div>
  )

  // ════════════════════════════════════════
  //  Step 4 — Done
  // ════════════════════════════════════════
  if (step === 4) return (
    <div className={`ob-body${isGM ? ' ob-body--dm' : ''}`}>
      <div className={`ob-panel${isGM ? ' ob-panel--dm' : ''}`}>
        <div className="ob-logo">{isGM ? '⚔️' : '🎲'}</div>
        <h1 className="ob-title">{isGM ? 'GM All Set!' : 'All set!'}</h1>
        <p className="ob-body-text">
          {isGM
            ? 'Your character and campaign repositories are ready. Time to start your adventure.'
            : 'Your character repository is ready. Time to create your first character!'
          }
        </p>

        {isGM && (
          <div className="ob-share-box">
            <div className="ob-share-label">Share your campaigns repo with players:</div>
            <div className="ob-share-url">github.com/{user.login}/{CAMPAIGNS_REPO}</div>
          </div>
        )}

        <button className={`ob-btn${isGM ? ' ob-btn--dm' : ' ob-btn--accent'}`} onClick={finish}>
          {isGM ? "Let's run a game →" : "Let's go →"}
        </button>
      </div>
    </div>
  )
}
