import type { CacheBusMessage } from '../types/bus.js'

export const busEvents = {
  messagePublished(message: CacheBusMessage) {
    return {
      name: 'bus:message:published',
      data: { message: { keys: message.keys, type: message.type } },
    }
  },
  messageReceived(message: CacheBusMessage) {
    return {
      name: 'bus:message:received',
      data: { message: { keys: message.keys, type: message.type } },
    }
  },
}
