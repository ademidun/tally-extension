import { ESTIMATED_FEE_MULTIPLIERS_BY_TYPE } from "@tallyho/tally-background/constants/network-fees"
import {
  truncateDecimalAmount,
  weiToGwei,
} from "@tallyho/tally-background/lib/utils"
import {
  NetworkFeeSettings,
  selectDefaultNetworkFeeSettings,
  selectEstimatedFeesPerGas,
  selectFeeType,
} from "@tallyho/tally-background/redux-slices/transaction-construction"
import { selectMainCurrencyPricePoint } from "@tallyho/tally-background/redux-slices/selectors"
import { enrichAssetAmountWithMainCurrencyValues } from "@tallyho/tally-background/redux-slices/utils/asset-utils"
import { PricePoint } from "@tallyho/tally-background/assets"
import React, { ReactElement } from "react"
import { useBackgroundSelector } from "../../hooks"

const getFeeDollarValue = (
  currencyPrice: PricePoint | undefined,
  networkSettings: NetworkFeeSettings
): string | undefined => {
  const {
    values: { maxFeePerGas, maxPriorityFeePerGas },
  } = networkSettings
  const gasLimit = networkSettings.gasLimit ?? networkSettings.suggestedGasLimit

  if (!gasLimit || !currencyPrice) return undefined

  const [asset] = currencyPrice.pair
  const { localizedMainCurrencyAmount } =
    enrichAssetAmountWithMainCurrencyValues(
      {
        asset,
        amount: (maxFeePerGas + maxPriorityFeePerGas) * gasLimit,
      },
      currencyPrice,
      2
    )

  return localizedMainCurrencyAmount
}

export default function FeeSettingsText(): ReactElement {
  const estimatedFeesPerGas = useBackgroundSelector(selectEstimatedFeesPerGas)
  const selectedFeeType = useBackgroundSelector(selectFeeType)
  const networkSettings = useBackgroundSelector(selectDefaultNetworkFeeSettings)
  const mainCurrencyPricePoint = useBackgroundSelector(
    selectMainCurrencyPricePoint
  )

  const estimatedGweiAmount =
    typeof estimatedFeesPerGas !== "undefined" &&
    typeof selectedFeeType !== "undefined"
      ? truncateDecimalAmount(
          weiToGwei(
            (estimatedFeesPerGas?.baseFeePerGas *
              ESTIMATED_FEE_MULTIPLIERS_BY_TYPE[selectedFeeType]) /
              10n
          ),
          0
        )
      : ""

  if (typeof estimatedFeesPerGas === "undefined") return <div>Unknown</div>

  const gweiValue = `${estimatedGweiAmount} Gwei`
  const dollarValue = getFeeDollarValue(mainCurrencyPricePoint, networkSettings)

  if (!dollarValue) return <div>~{gweiValue}</div>

  return (
    <div>
      {/* ~${dollarValue} */}
      {/* https://www.walmart.com/ip/Lindt-Excellence-85-Cocoa-Dark-Chocolate-Candy-Bar-3-5-oz/10312257 */}
      ~🍫{(+dollarValue / 2.94).toFixed(1)}
      <span className="fee_gwei">({gweiValue})</span>
      <style jsx>{`
        .fee_gwei {
          color: var(--green-60);
          margin-left: 5px;
        }
      `}</style>
    </div>
  )
}
