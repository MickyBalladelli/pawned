import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Lock } from '@mui/icons-material'
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
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={3}>
        <Box
          component="img"
          src="/images/pawned.png"
          alt="Vela"
          sx={{
            width: '100%',
            maxHeight: 260,
            aspectRatio: '591 / 567',
            objectFit: 'contain',
            borderRadius: 2,
          }}
        />

        <Card>
          <CardContent component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <Box sx={{ textAlign: 'left' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <Lock color="primary" />
                  <Typography variant="overline" color="text.secondary">
                    Sign in
                  </Typography>
                </Stack>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                  Vela Login
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
          </CardContent>
        </Card>
      </Stack>
    </Container>
  )
}

export default LoginPage
