import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'

function ChessResultOverlay({ message, tone = 'default', resultKey }) {
  const [visible, setVisible] = useState(Boolean(message))

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return undefined
    }

    setVisible(true)
    const timeout = window.setTimeout(() => setVisible(false), 4200)

    return () => window.clearTimeout(timeout)
  }, [message, resultKey])

  if (!message) {
    return null
  }

  const palette = tone === 'lost'
    ? {
        bgcolor: 'rgba(127, 29, 29, 0.88)',
        borderColor: 'rgba(254, 202, 202, 0.55)',
      }
    : tone === 'won'
      ? {
          bgcolor: 'rgba(20, 83, 45, 0.88)',
          borderColor: 'rgba(187, 247, 208, 0.55)',
        }
      : {
          bgcolor: 'rgba(30, 41, 59, 0.88)',
          borderColor: 'rgba(226, 232, 240, 0.5)',
        }

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 900ms ease',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          border: '1px solid',
          borderRadius: 1,
          boxShadow: '0 18px 38px rgba(15, 23, 42, 0.28)',
          color: 'common.white',
          textAlign: 'center',
          ...palette,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          {message}
        </Typography>
      </Box>
    </Box>
  )
}

export default ChessResultOverlay
