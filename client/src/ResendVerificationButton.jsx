import { Button } from '@mui/material'
import { MarkEmailUnread } from '@mui/icons-material'

function ResendVerificationButton({ disabled, onResend, resending }) {
  return (
    <Button
      type="button"
      size="small"
      variant="outlined"
      startIcon={<MarkEmailUnread />}
      disabled={disabled || resending}
      onClick={onResend}
    >
      {resending ? 'Sending again' : 'Send again'}
    </Button>
  )
}

export default ResendVerificationButton
