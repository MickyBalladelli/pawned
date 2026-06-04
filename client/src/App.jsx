import { useEffect, useMemo, useState } from 'react'
import { CssBaseline } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import AppContent from './AppContent'
import LoadingPage from './LoadingPage'
import LoginPage from './LoginPage'
import SignUpPage from './SignUpPage'
import VerifyEmailPage from './VerifyEmailPage'
import { requestJson } from './requestJson'
import './App.css'

const authTokenKey = 'pawnedAuthToken'
const themeModeKey = 'pawnedThemeMode'

function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(authTokenKey))
  const [authUser, setAuthUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(Boolean(localStorage.getItem(authTokenKey)))
  const [authenticating, setAuthenticating] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [authView, setAuthView] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.has('token') && window.location.pathname === '/verify-email' ? 'verify' : 'guest'
  })
  const [signingUp, setSigningUp] = useState(false)
  const [signupError, setSignupError] = useState(null)
  const [signupResult, setSignupResult] = useState(null)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [resendVerificationMessage, setResendVerificationMessage] = useState(null)
  const [authVerificationLink, setAuthVerificationLink] = useState(null)
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem(themeModeKey) || 'light')

  const theme = useMemo(() => createTheme({
    palette: {
      mode: themeMode,
      primary: {
        main: themeMode === 'dark' ? '#8bd3ff' : '#005c99',
      },
      secondary: {
        main: themeMode === 'dark' ? '#ffcf70' : '#8a5a00',
      },
      background: {
        default: themeMode === 'dark' ? '#101418' : '#f7f9fb',
        paper: themeMode === 'dark' ? '#18212a' : '#ffffff',
      },
      text: {
        primary: themeMode === 'dark' ? '#f4f7fb' : '#101820',
        secondary: themeMode === 'dark' ? '#b7c2ce' : '#4a5563',
      },
    },
    shape: {
      borderRadius: 8,
    },
  }), [themeMode])

  function toggleThemeMode() {
    setThemeMode((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem(themeModeKey, next)
      return next
    })
  }

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
    setAuthView('guest')
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
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoadingPage />
      </ThemeProvider>
    )
  }

  if (!authUser && authView !== 'guest') {
    if (authView === 'verify') {
      return (
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <VerifyEmailPage onBackToLogin={() => setAuthView('login')} />
        </ThemeProvider>
      )
    }

    if (authView === 'signup') {
      return (
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SignUpPage
            error={signupError}
            result={signupResult}
            signingUp={signingUp}
            onBackToLogin={() => setAuthView('login')}
            onClearError={() => setSignupError(null)}
            onSignUp={handleSignUp}
          />
        </ThemeProvider>
      )
    }

    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoginPage
          authenticating={authenticating}
          error={authError}
          verificationLink={authVerificationLink}
          resendMessage={resendVerificationMessage}
          resendingVerification={resendingVerification}
          onClearError={() => setAuthError(null)}
          onLogin={handleLogin}
          onResendVerification={(identifier) => handleResendVerification(identifier, true)}
          onReturnMain={() => setAuthView('guest')}
          onShowSignUp={() => setAuthView('signup')}
        />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContent
        authToken={authToken}
        authUser={authUser}
        themeMode={themeMode}
        onLogout={handleLogout}
        onShowLogin={() => setAuthView('login')}
        onToggleTheme={toggleThemeMode}
        onUserUpdated={setAuthUser}
      />
    </ThemeProvider>
  )
}

export default App
