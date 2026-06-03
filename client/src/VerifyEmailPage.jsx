import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from '@mui/material'
import { MarkEmailRead } from '@mui/icons-material'
import { requestJson } from './requestJson'

function getVerificationToken() {
  const params = new URLSearchParams(window.location.search)
  return params.get('token')
}

function VerifyEmailPage({ onBackToLogin }) {
  const [token] = useState(getVerificationToken)
  const [state, setState] = useState(() => ({
    loading: Boolean(token),
    message: null,
    error: token ? null : 'Verification token is missing',
  }))

  useEffect(() => {
    if (!token) {
      return
    }

    requestJson('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        window.history.replaceState({}, '', '/')
        setState({ loading: false, message: data.message, error: null })
      })
      .catch((err) => {
        setState({ loading: false, message: null, error: err.message })
      })
  }, [token])

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
          <CardContent>
            <Stack spacing={2.5}>
              <Box sx={{ textAlign: 'left' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <MarkEmailRead color="primary" />
                  <Typography variant="overline" color="text.secondary">
                    Verify mail
                  </Typography>
                </Stack>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                  Email Approval
                </Typography>
              </Box>

              {state.loading && <Alert severity="info">Checking verification link</Alert>}
              {state.message && <Alert severity="success">{state.message}</Alert>}
              {state.error && <Alert severity="error">{state.error}</Alert>}

              <Button type="button" variant="contained" onClick={onBackToLogin}>
                Back to sign in
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  )
}

export default VerifyEmailPage
