import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ArrowBack, Lock } from '@mui/icons-material'
import AuthSplitPage from './AuthSplitPage'
import PasswordField from './PasswordField'
import ResendVerificationButton from './ResendVerificationButton'

const pendingVerificationMessage = 'Account pending approval. Verify your email first.'

function LoginPage({
  authenticating,
  error,
  verificationLink,
  resendMessage,
  resendingVerification,
  onClearError,
  onLogin,
  onResendVerification,
  onReturnMain,
  onShowSignUp,
}) {
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const canResendVerification = error === pendingVerificationMessage && authForm.username.trim()

  async function handleSubmit(event) {
    event.preventDefault()
    await onLogin(authForm)
  }

  function handleResendVerification() {
    onResendVerification(authForm.username)
  }

  return (
    <AuthSplitPage
      topAction={
        <Button
          type="button"
          variant="text"
          startIcon={<ArrowBack />}
          onClick={onReturnMain}
        >
          Main page
        </Button>
      }
    >
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <Box sx={{ textAlign: 'left' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Lock color="primary" />
              <Typography variant="overline" color="text.secondary">
                Sign in
              </Typography>
            </Stack>
            <Typography variant="h4" component="h1" color="text.primary" sx={{ fontWeight: 700 }}>
              Pawned Login
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" onClose={onClearError}>
              {canResendVerification ? (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
                >
                  <Box>{error}</Box>
                  <ResendVerificationButton
                    resending={resendingVerification}
                    onResend={handleResendVerification}
                  />
                  {verificationLink && (
                    <Box sx={{ flexBasis: '100%', overflowWrap: 'anywhere' }}>
                      Dev link: {verificationLink}
                    </Box>
                  )}
                </Stack>
              ) : (
                error
              )}
            </Alert>
          )}

          {resendMessage && <Alert severity="success">{resendMessage}</Alert>}

          <TextField
            label="Username"
            value={authForm.username}
            onChange={(event) =>
              setAuthForm((current) => ({ ...current, username: event.target.value }))
            }
            size="small"
            fullWidth
            required
          />
          <PasswordField
            label="Password"
            value={authForm.password}
            onChange={(event) =>
              setAuthForm((current) => ({ ...current, password: event.target.value }))
            }
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={authenticating}>
            {authenticating ? 'Signing in' : 'Sign in'}
          </Button>
          <Button type="button" variant="text" onClick={onShowSignUp}>
            Create account
          </Button>
        </Stack>
      </Box>
    </AuthSplitPage>
  )
}

export default LoginPage
