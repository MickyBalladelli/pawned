import { useEffect, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { Check, Close, PersonRemove } from '@mui/icons-material'
import { requestJson } from './requestJson'

function getInitial(username) {
  return username?.trim().charAt(0).toUpperCase() || '?'
}

function ChannelMembershipDialog({
  open,
  channel,
  authUser,
  authHeaders,
  onClose,
  onChanged,
  onError,
  onNotice,
}) {
  const [members, setMembers] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const channelId = channel?.id

  async function loadMembership() {
    if (!channelId || !open) {
      return
    }

    setLoading(true)

    try {
      const [memberData, requestData] = await Promise.all([
        requestJson(`/api/channels/${channelId}/members`, {
          headers: authHeaders,
        }),
        requestJson(`/api/channels/${channelId}/membership-requests`, {
          headers: authHeaders,
        }),
      ])

      setMembers(memberData)
      setRequests(requestData)
    } catch (err) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!channelId || !open) {
      return undefined
    }

    let active = true
    const load = Promise.resolve().then(async () => {
      setLoading(true)

      try {
        const [memberData, requestData] = await Promise.all([
          requestJson(`/api/channels/${channelId}/members`, {
            headers: authHeaders,
          }),
          requestJson(`/api/channels/${channelId}/membership-requests`, {
            headers: authHeaders,
          }),
        ])

        if (active) {
          setMembers(memberData)
          setRequests(requestData)
        }
      } catch (err) {
        if (active) {
          onError(err.message)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })

    return () => {
      active = false
      load.catch(() => {})
    }
  }, [authHeaders, channelId, onError, open])

  async function updateRequest(request, action) {
    setBusyId(`request-${request.id}`)
    onError(null)
    onNotice(null)

    try {
      await requestJson(`/api/channels/${channelId}/membership-requests/${request.id}/${action}`, {
        method: 'POST',
        headers: authHeaders,
      })
      onNotice(action === 'approve' ? 'Member approved' : 'Request rejected')
      await loadMembership()
      await onChanged()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function removeMember(member) {
    setBusyId(`member-${member.user_id}`)
    onError(null)
    onNotice(null)

    try {
      await requestJson(`/api/channels/${channelId}/members/${member.user_id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      onNotice('Member removed')
      await loadMembership()
      await onChanged()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{channel ? `#${channel.name} members` : 'Members'}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Stack sx={{ alignItems: 'center', py: 5 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 900, mb: 1 }}>
                Requests
              </Typography>
              {requests.length === 0 ? (
                <Typography color="text.secondary">No pending requests</Typography>
              ) : (
                <List disablePadding>
                  {requests.map((request) => (
                    <ListItem
                      key={request.id}
                      disableGutters
                      secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Approve">
                            <span>
                              <IconButton
                                color="success"
                                disabled={busyId === `request-${request.id}`}
                                onClick={() => updateRequest(request, 'approve')}
                              >
                                <Check />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <span>
                              <IconButton
                                color="error"
                                disabled={busyId === `request-${request.id}`}
                                onClick={() => updateRequest(request, 'reject')}
                              >
                                <Close />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar src={request.avatar_url || undefined}>
                          {getInitial(request.username)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={request.username} secondary="Wants to join" />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 900, mb: 1 }}>
                Members
              </Typography>
              {members.length === 0 ? (
                <Typography color="text.secondary">No members yet</Typography>
              ) : (
                <List disablePadding>
                  {members.map((member) => {
                    const isOwner = member.role === 'owner'
                    const isSelf = Number(member.user_id) === Number(authUser.id)

                    return (
                      <ListItem
                        key={member.id}
                        disableGutters
                        secondaryAction={
                          !isOwner && !isSelf ? (
                            <Tooltip title="Remove member">
                              <span>
                                <IconButton
                                  color="error"
                                  disabled={busyId === `member-${member.user_id}`}
                                  onClick={() => removeMember(member)}
                                >
                                  <PersonRemove />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : null
                        }
                      >
                        <ListItemAvatar>
                          <Avatar src={member.avatar_url || undefined}>
                            {getInitial(member.username)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={member.username}
                          secondary={isOwner ? 'Owner' : 'Member'}
                        />
                      </ListItem>
                    )
                  })}
                </List>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default ChannelMembershipDialog
