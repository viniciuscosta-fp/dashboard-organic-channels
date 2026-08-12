import { getEnv } from '../env'
import type { ChannelRepository } from './channel-repository'
import { parseChannelRows } from './channels-parser'
import { fetchSheetValues } from './sheets-client'
import type { ChannelInfo } from './types'

/** Lê o cadastro de canais da aba `canais`, na mesma planilha do funil. */
export class SheetsChannelRepository implements ChannelRepository {
  readonly source = 'sheets' as const

  async getChannels(): Promise<ChannelInfo[]> {
    return parseChannelRows(await fetchSheetValues(getEnv().CHANNELS_SHEET_RANGE))
  }
}
