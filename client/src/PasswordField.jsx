import { useState } from 'react'
import { Button, Stack, TextField } from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'

function PasswordField(props) {
  const [visible, setVisible] = useState(false)
  const { fullWidth, ...textFieldProps } = props

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'flex-start', width: fullWidth ? '100%' : 'auto' }}
    >
      <TextField
        {...textFieldProps}
        type={visible ? 'text' : 'password'}
        fullWidth={fullWidth}
        size={textFieldProps.size || 'small'}
      />
      <Button
        type="button"
        variant="outlined"
        startIcon={visible ? <VisibilityOff /> : <Visibility />}
        onClick={() => setVisible((current) => !current)}
        sx={{ mt: 1, minWidth: 104 }}
      >
        {visible ? 'Hide' : 'Show'}
      </Button>
    </Stack>
  )
}

export default PasswordField
