import { useState } from 'react'
import { Avatar, Box, Chip, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material'
import { AdminPanelSettings, Code, Diamond, Shield } from '@mui/icons-material'

const groupWindowMs = 5 * 60 * 1000

function formatMessageTime(value) {
  if (!value) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatFullTime(value) {
  if (!value) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getInitial(username) {
  return username?.trim().charAt(0).toUpperCase() || '?'
}

function shouldShowHeader(message, previousMessage) {
  if (!previousMessage) {
    return true
  }

  if (message.username !== previousMessage.username) {
    return true
  }

  const messageDate = new Date(message.created_at).getTime()
  const previousDate = new Date(previousMessage.created_at).getTime()

  if (Number.isNaN(messageDate) || Number.isNaN(previousDate)) {
    return true
  }

  return messageDate - previousDate > groupWindowMs
}

function getMessageRole(message) {
  if (message.role) {
    return message.role
  }

  return message.is_admin ? 'admin' : 'user'
}

function canModerateUser(authUser, message) {
  const authRole = authUser?.is_admin || authUser?.role === 'developer' ? 'admin' : authUser?.role || 'user'
  const messageRole = getMessageRole(message)

  if (Number(message.user_id) === Number(authUser.id)) {
    return false
  }

  if (authRole === 'admin') {
    return true
  }

  return authRole === 'moderator' && messageRole === 'user'
}

function ChannelMessageList({ authUser, messages, endRef, onDeleteMessage, onBlockUser }) {
  const [messageMenu, setMessageMenu] = useState(null)

  function openMessageMenu(event, message) {
    const canDelete = message.user_id === authUser.id || authUser.is_admin || authUser.role === 'admin' || authUser.role === 'developer' || authUser.role === 'moderator'
    const canBlock = Boolean(onBlockUser && canModerateUser(authUser, message))

    if (!canDelete && !canBlock) {
      return
    }

    event.preventDefault()
    setMessageMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      message,
      canDelete,
      canBlock,
    })
  }

  function closeMessageMenu() {
    setMessageMenu(null)
  }

  async function handleDeleteMessage() {
    const message = messageMenu?.message
    closeMessageMenu()

    if (message) {
      await onDeleteMessage(message)
    }
  }

  async function handleBlockUser() {
    const message = messageMenu?.message
    closeMessageMenu()

    if (message) {
      await onBlockUser(message.user_id)
    }
  }

  return (
    <Box
      sx={{
        height: '100%',
        overflowY: 'auto',
        pr: 0.5,
        mx: -1,
      }}
    >
      {messages.map((message, index) => {
        if (message.is_presence_notice) {
          return (
            <Box
              key={message.id}
              sx={{
                px: 1,
                py: 0.5,
                textAlign: 'center',
              }}
            >
              <Typography
                component="span"
                sx={{
                  display: 'inline-block',
                  px: 1.25,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  color: 'text.secondary',
                  fontSize: 12,
                  fontStyle: 'italic',
                  lineHeight: 1.4,
                }}
              >
                {message.content}
              </Typography>
            </Box>
          )
        }

        const hasHeader = shouldShowHeader(message, messages[index - 1])
        const role = getMessageRole(message)
        const isAdminMessage = role === 'admin'
        const isModeratorMessage = role === 'moderator'
        const isDeveloperMessage = role === 'developer'
        const isVipMessage = role === 'vip'

        return (
          <Box
            key={message.id}
            onContextMenu={(event) => openMessageMenu(event, message)}
            sx={{
              display: 'grid',
              gridTemplateColumns: '40px minmax(0, 1fr)',
              columnGap: 1.25,
              px: 1,
              pt: hasHeader ? 1.25 : 0.125,
              pb: 0.125,
              textAlign: 'left',
              '&:hover': {
                bgcolor: isAdminMessage
                  ? 'rgba(211, 47, 47, 0.16)'
                  : isModeratorMessage
                    ? 'rgba(237, 108, 2, 0.14)'
                    : isDeveloperMessage
                      ? 'rgba(46, 125, 50, 0.14)'
                      : isVipMessage
                        ? 'rgba(2, 136, 209, 0.14)'
                      : 'action.hover',
              },
              '&:hover .message-time': {
                opacity: 1,
              },
            }}
          >
            {hasHeader ? (
              <Avatar
                src={message.avatar_url || undefined}
                sx={{
                  width: 32,
                  height: 32,
                  mt: 0.25,
                  fontSize: 14,
                  fontWeight: 800,
                  bgcolor: 'primary.main',
                  border: isAdminMessage ? '2px solid' : isModeratorMessage || isDeveloperMessage || isVipMessage ? '1px solid' : 0,
                  borderColor: isAdminMessage
                    ? 'error.main'
                    : isModeratorMessage
                      ? 'warning.main'
                      : isDeveloperMessage
                        ? 'success.main'
                        : 'info.main',
                }}
              >
                {getInitial(message.username)}
              </Avatar>
            ) : (
              <Typography
                className="message-time"
                variant="caption"
                color="text.secondary"
                sx={{
                  opacity: 0,
                  justifySelf: 'end',
                  pt: 0.2,
                  fontSize: 11,
                  lineHeight: '20px',
                }}
              >
                {formatMessageTime(message.created_at)}
              </Typography>
            )}

            <Box sx={{ minWidth: 0 }}>
              {hasHeader && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'baseline', minWidth: 0, mb: 0.125 }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: 14,
                      fontWeight: isAdminMessage ? 950 : 800,
                      lineHeight: 1.25,
                      color: isAdminMessage
                        ? 'error.main'
                        : isModeratorMessage
                          ? 'warning.main'
                          : isDeveloperMessage
                            ? 'success.main'
                            : isVipMessage
                              ? 'info.main'
                            : 'text.primary',
                    }}
                  >
                    {message.username}
                  </Typography>
                  {isAdminMessage && (
                    <Chip
                      size="small"
                      icon={<AdminPanelSettings />}
                      label="admin"
                      color="error"
                      sx={{ height: 20, fontWeight: 900 }}
                    />
                  )}
                  {isModeratorMessage && (
                    <Chip
                      size="small"
                      icon={<Shield />}
                      label="mod"
                      color="warning"
                      sx={{ height: 20, fontWeight: 900 }}
                    />
                  )}
                  {isDeveloperMessage && (
                    <Chip
                      size="small"
                      icon={<Code />}
                      label="dev"
                      color="success"
                      sx={{ height: 20, fontWeight: 900 }}
                    />
                  )}
                  {isVipMessage && (
                    <Chip
                      size="small"
                      icon={<Diamond />}
                      label="vip"
                      color="info"
                      sx={{ height: 20, fontWeight: 900 }}
                    />
                  )}
                  <Tooltip title={formatFullTime(message.created_at)}>
                    <Typography
                      component="span"
                      color="text.secondary"
                      sx={{ fontSize: 11.5, lineHeight: 1.25 }}
                    >
                      {formatMessageTime(message.created_at)}
                    </Typography>
                  </Tooltip>
                </Stack>
              )}
              <Typography
                sx={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: 14,
                  lineHeight: 1.35,
                  color: 'text.primary',
                  fontWeight: isAdminMessage ? 650 : 400,
                }}
              >
                {message.content}
              </Typography>
            </Box>
          </Box>
        )
      })}
      <Box ref={endRef} />
      <Menu
        open={Boolean(messageMenu)}
        onClose={closeMessageMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          messageMenu
            ? { top: messageMenu.mouseY, left: messageMenu.mouseX }
            : undefined
        }
      >
        {messageMenu?.canDelete && <MenuItem onClick={handleDeleteMessage}>Delete message</MenuItem>}
        {messageMenu?.canBlock && <MenuItem onClick={handleBlockUser}>Block user</MenuItem>}
      </Menu>
    </Box>
  )
}

export default ChannelMessageList
