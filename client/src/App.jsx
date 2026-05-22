import { useEffect, useState } from 'react'
import AppContent from './AppContent'
import LoadingPage from './LoadingPage'
import LoginPage from './LoginPage'
import SignUpPage from './SignUpPage'
import VerifyEmailPage from './VerifyEmailPage'
import { requestJson } from './requestJson'
import './App.css'

const authTokenKey = 'velaAuthToken'

function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(authTokenKey))
  const [authUser, setAuthUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(Boolean(localStorage.getItem(authTokenKey)))
  const [authenticating, setAuthenticating] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [authView, setAuthView] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.has('token') && window.location.pathname === '/verify-email' ? 'verify' : 'login'
  })
  const [signingUp, setSigningUp] = useState(false)
  const [signupError, setSignupError] = useState(null)
  const [signupResult, setSignupResult] = useState(null)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [resendVerificationMessage, setResendVerificationMessage] = useState(null)
  const [authVerificationLink, setAuthVerificationLink] = useState(null)

  function clearAuth() {
    localStorage.removeItem(authTokenKey)
    setAuthToken(null)
    setAuthUser(null)
    setLoadingAuth(false)
  }

  async function handleLogin(authForm) {
    setAuthenticating(true)
    setAuthError(null)
    setResendVerificationMessage(null)
    setAuthVerificationLink(null)

    try {
      const data = await requestJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(authForm),
      })

      localStorage.setItem(authTokenKey, data.token)
      setAuthToken(data.token)
      setAuthUser(data.user)
    } catch (err) {
      setAuthError(err.message)
      setAuthVerificationLink(err.payload?.verificationLink || null)
    } finally {
      setAuthenticating(false)
    }
  }

  async function handleSignUp(signupForm) {
    setSigningUp(true)
    setSignupError(null)
    setSignupResult(null)

    try {
      const data = await requestJson('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(signupForm),
      })

      setSignupResult(data)
    } catch (err) {
      setSignupError(err.message)
    } finally {
      setSigningUp(false)
    }
  }

  async function handleResendVerification(identifier, showOnLogin = false) {
    setResendingVerification(true)
    setSignupError(null)
    setAuthError(null)
    setResendVerificationMessage(null)
    setAuthVerificationLink(null)

    try {
      const data = await requestJson('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      })

      if (showOnLogin) {
        setResendVerificationMessage(data.message)
        setAuthVerificationLink(data.verificationLink || null)
      } else {
        setSignupResult(data)
      }
    } catch (err) {
      if (showOnLogin) {
        setAuthError(err.message)
      } else {
        setSignupError(err.message)
      }
    } finally {
      setResendingVerification(false)
    }
  }

  async function handleLogout() {
    if (authToken) {
      requestJson('/api/auth/logout', {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      }).catch(() => {})
    }

    clearAuth()
  }

  useEffect(() => {
    if (!authToken) {
      return undefined
    }

    let isMounted = true

    const load = requestJson('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then((data) => {
        if (isMounted) {
          setAuthUser(data.user)
        }
      })
      .catch(() => {
        if (isMounted) {
          clearAuth()
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingAuth(false)
        }
      })

    return () => {
      isMounted = false
      load.catch(() => {})
    }
  }, [authToken])

  if (loadingAuth) {
    return <LoadingPage />
  }

  if (!authUser) {
    if (authView === 'verify') {
      return <VerifyEmailPage onBackToLogin={() => setAuthView('login')} />
    }

    if (authView === 'signup') {
      return (
        <SignUpPage
          error={signupError}
          result={signupResult}
          resendingVerification={resendingVerification}
          signingUp={signingUp}
          onBackToLogin={() => setAuthView('login')}
          onClearError={() => setSignupError(null)}
          onResendVerification={handleResendVerification}
          onSignUp={handleSignUp}
        />
      )
    }

    return (
      <LoginPage
        authenticating={authenticating}
        error={authError}
        verificationLink={authVerificationLink}
        resendMessage={resendVerificationMessage}
        resendingVerification={resendingVerification}
        onClearError={() => setAuthError(null)}
        onLogin={handleLogin}
        onResendVerification={(identifier) => handleResendVerification(identifier, true)}
        onShowSignUp={() => setAuthView('signup')}
      />
    )
  }

  return (
    <AppContent
      authToken={authToken}
      authUser={authUser}
      onLogout={handleLogout}
      onUserUpdated={setAuthUser}
    />
  )
}

export default App
