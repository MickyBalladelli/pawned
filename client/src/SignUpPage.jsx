import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { PersonAdd } from '@mui/icons-material'
import PasswordField from './PasswordField'
import ResendVerificationButton from './ResendVerificationButton'
import { requestJson } from './requestJson'

function SignUpPage({
  error,
  result,
  resendingVerification,
  signingUp,
  onBackToLogin,
  onClearError,
  onResendVerification,
  onSignUp,
}) {
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [usernameState, setUsernameState] = useState({ checking: false, available: null, error: null })

  const passwordsMatch = useMemo(() => {
    return !form.confirmPassword || form.password === form.confirmPassword
  }, [form.confirmPassword, form.password])

  useEffect(() => {
    const username = form.username.trim()

    if (!username) {
      return undefined
    }

    let active = true

    const timeout = window.setTimeout(() => {
      requestJson(`/api/auth/username-available?username=${encodeURIComponent(username)}`)
        .then((data) => {
          if (active) {
            setUsernameState({ checking: false, available: data.available, error: null })
          }
        })
        .catch((err) => {
          if (active) {
            setUsernameState({ checking: false, available: null, error: err.message })
          }
        })
    }, 350)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [form.username])

  function updateField(field, value) {
    onClearError()
    if (field === 'username') {
      setUsernameState({
        checking: Boolean(value.trim()),
        available: null,
        error: null,
      })
    }
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await onSignUp(form)
  }

  function handleResendVerification() {
    onResendVerification(form.email)
  }

  const usernameHelperText =
    usernameState.error ||
    (usernameState.checking && 'Checking username') ||
    (usernameState.available === true && 'Username is free') ||
    (usernameState.available === false && 'Username is taken') ||
    ' '

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={3}>
        <Box
          component="img"
          src="/images/pawned.png"
          alt="Pawned"
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
                  <PersonAdd color="primary" />
                  <Typography variant="overline" color="text.secondary">
                    Sign up
                  </Typography>
                </Stack>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                  Create Pawned Account
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" onClose={onClearError}>
                  {error}
                </Alert>
              )}

              {result && (
                <Alert severity="success">
                  {result.message}
                  {result.verificationLink && (
                    <Box sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                      Dev link: {result.verificationLink}
                    </Box>
                  )}
                  <Box sx={{ mt: 1 }}>
                    <ResendVerificationButton
                      disabled={!form.email}
                      resending={resendingVerification}
                      onResend={handleResendVerification}
                    />
                  </Box>
                </Alert>
              )}

              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                size="small"
                fullWidth
                required
              />
              <TextField
                label="Username"
                value={form.username}
                onChange={(event) => updateField('username', event.target.value)}
                error={usernameState.available === false}
                helperText={usernameHelperText}
                InputProps={{
                  endAdornment: usernameState.checking ? <CircularProgress size={18} /> : null,
                }}
                size="small"
                fullWidth
                required
              />
              <PasswordField
                label="Password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                helperText="At least 6 characters"
                fullWidth
                required
              />
              <PasswordField
                label="Confirm password"
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                error={!passwordsMatch}
                helperText={passwordsMatch ? ' ' : 'Passwords do not match'}
                fullWidth
                required
              />
              <Button
                type="submit"
                variant="contained"
                disabled={signingUp || usernameState.available === false || !passwordsMatch}
              >
                {signingUp ? 'Creating account' : 'Create account'}
              </Button>
              <Button type="button" variant="text" onClick={onBackToLogin}>
                Back to sign in
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  )
}

export default SignUpPage
