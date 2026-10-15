import { useMemo } from 'react'
import { useEconomy } from '../EconomyContext'
import { RARITY_ORDER, getRarityStyle } from '../utils/rarityUtils'

const CrateDropTable = () => {

    const { snapshot } = useEconomy()

    const catalog = snapshot?.catalog ?? []
    const odds = snapshot?.rarityOdds ?? {}

    const rows = useMemo(() => RARITY_ORDER
        .map((rarity) => ({
            rarity,
            chance: odds[rarity] ?? 0,
            total: catalog.filter((item) => item.rarity === rarity).length,
        }))
        .filter((row) => row.total), [catalog, odds])

    return (
        <div className='flex flex-col gap-3'>

            <h2 className='text-sm font-semibold text-neutral0'>Possible Drops</h2>

            <div className='flex flex-col'>
                {rows.map((row) => {

                    const style = getRarityStyle(row.rarity)

                    return (
                        <div key={row.rarity} className='flex items-center gap-3 py-2'>
                            <span className={`size-2 shrink-0 rounded-full ${style.bar}`} />

                            <span className={`flex-1 text-sm font-semibold ${style.text}`}>
                                {row.rarity}
                            </span>

                            <span className='text-sm text-neutral1 tabular-nums'>
                                {row.chance}%
                            </span>
                        </div>
                    )
                })}
            </div>

        </div>
    )
}

export default CrateDropTable
