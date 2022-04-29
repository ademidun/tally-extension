import React, { ReactElement, useCallback, useEffect, useState } from "react"
import {
  selectCurrentAccount,
  selectCurrentAccountBalances,
} from "@tallyho/tally-background/redux-slices/selectors"
import {
  ApprovalTargetAllowance,
  approveApprovalTarget,
  AvailableVault,
  checkApprovalTargetApproval,
  claimVaultRewards,
  clearSignature,
  inputAmount,
  permitVaultDeposit,
  selectCurrentlyApproving,
  selectCurrentlyDepositing,
  selectDepositingProcess,
  selectEarnInputAmount,
  updateVaults,
  vaultDeposit,
  vaultWithdraw,
} from "@tallyho/tally-background/redux-slices/earn"

import { fromFixedPointNumber } from "@tallyho/tally-background/lib/fixed-point"
import { doggoTokenDecimalDigits } from "@tallyho/tally-background/constants"
import { HexString } from "@tallyho/tally-background/types"

import { useHistory, useLocation } from "react-router-dom"
import BackButton from "../components/Shared/SharedBackButton"
import SharedAssetIcon from "../components/Shared/SharedAssetIcon"

import SharedButton from "../components/Shared/SharedButton"
import SharedPanelSwitcher from "../components/Shared/SharedPanelSwitcher"
import SharedAssetInput from "../components/Shared/SharedAssetInput"
import SharedSlideUpMenu from "../components/Shared/SharedSlideUpMenu"
import { useBackgroundDispatch, useBackgroundSelector } from "../hooks"
import EmptyBowl from "../components/Earn/EmptyBowl/EmptyBowl"

export default function EarnDeposit(): ReactElement {
  const storedInput = useBackgroundSelector(selectEarnInputAmount)
  const [panelNumber, setPanelNumber] = useState(0)
  const [amount, setAmount] = useState(storedInput)
  const [hasError, setHasError] = useState(false)
  const [withdrawSlideupVisible, setWithdrawalSlideupVisible] = useState(false)
  const [isApproved, setIsApproved] = useState(true)
  const [deposited, setDeposited] = useState(false)

  const { vaultAddress } = useLocation().state as {
    vaultAddress: HexString
  }
  const vault = useBackgroundSelector((state) =>
    state.earn.availableVaults.find(
      (availableVault) => availableVault.vaultAddress === vaultAddress
    )
  )
  const [vaultData, setVaultData] = useState<AvailableVault | undefined>(vault)
  const dispatch = useBackgroundDispatch()

  const history = useHistory()

  const isCurrentlyApproving = useBackgroundSelector(selectCurrentlyApproving)
  const inDepositProcess = useBackgroundSelector(selectDepositingProcess)
  const isDepositPending = useBackgroundSelector(selectCurrentlyDepositing)

  const account = useBackgroundSelector(selectCurrentAccount)
  const accountBalances = useBackgroundSelector(selectCurrentAccountBalances)

  useEffect(() => {
    if (typeof vault?.asset?.contractAddress !== "undefined") {
      const checkApproval = async () => {
        const getApprovalAmount = async () => {
          const approvedAmount = (await dispatch(
            checkApprovalTargetApproval(vault.asset.contractAddress)
          )) as unknown as ApprovalTargetAllowance
          return approvedAmount.allowance
        }
        const allowance = await getApprovalAmount()
        const allowanceGreaterThanAmount = allowance >= Number(amount)
        setIsApproved(allowanceGreaterThanAmount)
      }
      checkApproval()
    }
  }, [
    amount,
    dispatch,
    vault?.asset?.contractAddress,
    account.address,
    isCurrentlyApproving,
  ])

  const getUpdatedVault = useCallback(async () => {
    if (typeof vault !== "undefined") {
      const updatedVault = (await dispatch(
        updateVaults([vault])
      )) as unknown as AvailableVault[]
      setVaultData(updatedVault[0])
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, vault?.pendingRewards, vault?.userDeposited])

  useEffect(() => {
    getUpdatedVault()
    return () => {
      dispatch(clearSignature())
    }
  }, [dispatch, getUpdatedVault])

  useEffect(() => {
    if (inDepositProcess && typeof vault !== "undefined") {
      dispatch(
        vaultDeposit({
          vault,
          amount,
          tokenAddress: vault.asset.contractAddress,
        })
      )
    }
  }, [amount, dispatch, history, inDepositProcess, vault])

  if (typeof vault === "undefined") {
    return <></>
  }

  const pendingRewards = fromFixedPointNumber(
    {
      amount: vaultData?.pendingRewards || 0n,
      decimals: doggoTokenDecimalDigits,
    },
    2
  )

  const userDeposited = fromFixedPointNumber(
    { amount: vaultData?.userDeposited || 0n, decimals: vault.asset.decimals },
    4
  )

  if (
    typeof userDeposited !== "undefined" &&
    userDeposited > 0 &&
    deposited === false
  ) {
    setDeposited(true)
  } else if (
    typeof userDeposited !== "undefined" &&
    userDeposited === 0 &&
    deposited === true
  ) {
    setDeposited(false)
  }

  const showWithdrawalModal = () => {
    setWithdrawalSlideupVisible(true)
  }

  const approve = async () => {
    dispatch(approveApprovalTarget(vault.asset.contractAddress))
  }

  const deposit = async () => {
    dispatch(
      permitVaultDeposit({
        vault,
        tokenAddress: vault.asset.contractAddress,
        amount,
      })
    )
    history.push("/sign-data")
  }

  const withdraw = async () => {
    dispatch(
      vaultWithdraw({
        vault,
      })
    )
    setDeposited(false)
    setWithdrawalSlideupVisible(false)
  }

  const claimRewards = async () => {
    dispatch(claimVaultRewards(vault))
  }

  const handleAmountChange = (
    value: string,
    errorMessage: string | undefined
  ) => {
    setAmount(value)
    dispatch(inputAmount(value))
    if (errorMessage) {
      setHasError(true)
    } else {
      setHasError(false)
    }
  }

  const approveButtonText = () => {
    if (isCurrentlyApproving === true) {
      return "Approving..."
    }
    return "Approve asset"
  }

  return (
    <>
      <section className="primary_info">
        <BackButton path="/earn" />
        <ul className="wrapper">
          <li className="row header">
            <div className="type">VAULT</div>
            <div className="center">
              <SharedAssetIcon size="large" symbol={vault?.asset.symbol} />
              <h1 className="asset_name">{vault?.asset.symbol}</h1>
            </div>
            <div>
              {/* @TODO: Generalize for other networks */}
              <a
                href={`https://etherscan.io/address/${vault.vaultAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                <div className="contract">
                  <div className="contract_link">Contract</div>
                  <span className="external" />
                </div>
              </a>
            </div>
          </li>
          <li className="row">
            <div className="label">Estimated APR</div>
            <div className="amount">{vaultData?.APR?.totalAPR}</div>
          </li>
          <li className="row">
            <div className="label">Total value locked</div>
            <div className="amount">
              {vaultData?.localValueTotalDeposited
                ? `$${vaultData?.localValueTotalDeposited}`
                : "Unknown"}
            </div>
          </li>
          <li className="row">
            <div className="label">Rewards</div>
            <div className="rewards">
              <img className="lock" src="./images/lock@2.png" alt="Locked" />
              DOGGO
            </div>
          </li>
        </ul>
        {deposited || pendingRewards > 0 ? (
          <div className="wrapper">
            <li className="row">
              <div className="label">Deposited amount</div>
              <div className="amount">
                {userDeposited}
                <span className="token">{vault?.asset.symbol}</span>
              </div>
            </li>
            <div className="divider" />
            <li className="row">
              <div className="label">Available rewards</div>
              <div className="amount">
                {pendingRewards} <span className="token">DOGGO</span>
              </div>
            </li>
            <li className="row claim">
              <button className="row" onClick={claimRewards} type="button">
                <div className="receive_icon" />
                Claim rewards
              </button>
            </li>
          </div>
        ) : (
          <></>
        )}
      </section>
      <SharedPanelSwitcher
        setPanelNumber={setPanelNumber}
        panelNumber={panelNumber}
        panelNames={["Deposit", "Withdraw", "Pool Info"]}
      />
      {panelNumber === 0 ? (
        <div className="deposit_wrap">
          <SharedAssetInput
            assetsAndAmounts={accountBalances?.assetAmounts}
            label="Deposit asset"
            onAmountChange={(value, errorMessage) =>
              handleAmountChange(value, errorMessage)
            }
            selectedAsset={{
              name: vault.asset.name,
              symbol: vault.asset.symbol,
              contractAddress: vault.asset.contractAddress,
            }}
            amount={amount}
            disableDropdown
          />
          <div className="confirm">
            {!isApproved || isCurrentlyApproving ? (
              <SharedButton
                type="primary"
                size="large"
                isDisabled={
                  hasError || Number(amount) === 0 || isCurrentlyApproving
                }
                onClick={approve}
              >
                {approveButtonText()}
              </SharedButton>
            ) : (
              <SharedButton
                type="primary"
                size="large"
                onClick={deposit}
                isDisabled={hasError || Number(amount) === 0}
              >
                {isDepositPending ? "Depositing..." : "Authorize & Deposit"}
              </SharedButton>
            )}
          </div>
        </div>
      ) : (
        <></>
      )}
      {panelNumber === 1 &&
        (userDeposited > 0 ? (
          <div className="standard_width">
            <ul className="list">
              <li className="list_item">
                You can withdraw only the rewards by using the Claim rewards
                button.
              </li>
              <li className="list_item">
                Deposit can only be withdrawn in full.
              </li>
            </ul>
            <div className="withdraw_button">
              <SharedButton
                type="secondary"
                size="large"
                onClick={showWithdrawalModal}
              >
                Withdraw deposit
              </SharedButton>
            </div>
            <SharedSlideUpMenu
              isOpen={withdrawSlideupVisible}
              close={() => setWithdrawalSlideupVisible(false)}
              size="custom"
              customSize="300px"
            >
              <div className="container">
                <h2 className="withdrawal_title">Withdraw deposit</h2>
                <div className="withdrawal_info">
                  Are you sure you want to withdraw deposited amount?
                </div>
                <div className="wrapper dark">
                  <li className="row">
                    <div className="label">Withdraw amount</div>
                    <div className="amount">
                      {userDeposited}
                      <span className="token">{vault.asset.symbol}</span>
                    </div>
                  </li>
                </div>
                <li className="row">
                  <SharedButton
                    size="large"
                    type="secondary"
                    onClick={() => setWithdrawalSlideupVisible(false)}
                  >
                    Cancel
                  </SharedButton>{" "}
                  <SharedButton size="large" type="primary" onClick={withdraw}>
                    Confirm Withdraw
                  </SharedButton>
                </li>
              </div>
            </SharedSlideUpMenu>
          </div>
        ) : (
          <EmptyBowl />
        ))}
      {panelNumber === 2 ? (
        <div className="standard_width ">
          <p className="pool_info">
            This token represents a Curve liquidity pool. Holders earn fees from
            users trading in the pool, and can also deposit the LP to
            Curve&apos;s gauges to earn CRV emissions.
          </p>
          <p className="pool_info">
            This pool contains FEI, FRAX, and alUSD, three decentralized
            dollar-pegged stablecoins.
          </p>
        </div>
      ) : (
        <></>
      )}
      <style jsx>
        {`
          .primary_info {
            margin-top: 15px;
            width: 90%;
          }
          .withdrawal_title {
            font-size: 18px;
            margin: 0;
          }
          .withdrawal_info {
            padding: 24px 0 12px 0;
            line-height: 24px;
          }
          .container {
            padding: 0 24px;
            display: flex;
            height: 90%;
            width: 100%;
            position: relative;
            top: -16px;
            box-sizing: border-box;
            flex-direction: column;
            justify-content: space-between;
          }
          .row {
            position: relative;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
          }
          .header {
            padding-bottom: 48px;
          }
          .pool_info {
            padding: 0 12px;
          }
          .withdraw_button {
            display: flex;
            justify-content: flex-start;
            margin-bottom: 20px;
            margin-left: 24px;
          }
          .row.claim {
            justify-content: flex-end;
            color: var(--trophy-gold);
            font-weight: bold;
            cursor: pointer;
          }
          .receive_icon {
            mask-size: 12px 12px;
            height: 12px;
            width: 12px;
            mask-image: url("./images/receive@2x.png");
            margin-right: 8px;
            background-color: var(--trophy-gold);
          }
          .token {
            margin-left: 8px;
            font-size: 14px;
          }
          .divider {
            height: 1px;
            background-color: #33514e;
          }
          .amount {
            font-size: 18px;
            font-weight: 500;
          }
          .list {
            display: flex;
            flex-flow: column;
            margin: 20px 0;
            padding-left: 40px;
          }
          .list_item {
            display: list-item;
            line-height: 24px;
            list-style-type: disc;
          }
          .label {
            color: var(--green-40);
            font-size: 14px;
          }
          .contract {
            display: flex;
            align-items: center;
            gap: 4px;
            justify-content: flex-end;
          }
          .contract_link {
            text-decoration: none;
            color: var(--green-40);
            font-size: 16px;
            font-weight: 400;
            height: 17px;
          }
          .contract:hover .contract_link {
            color: #fff;
          }
          .external {
            mask-image: url("./images/external_small@2x.png");
            mask-size: 12px 12px;
            width: 12px;
            height: 12px;
            background-color: var(--green-40);
          }
          .contract:hover .external {
            background-color: #fff;
          }
          .wrapper {
            width: 100%;
            margin: 0 auto;
            display: flex;
            flex-flow: column;
            box-sizing: border-box;
            padding: 12px 16px;
            gap: 12px;
            border: 1px solid #33514e;
            margin-bottom: 16px;
          }
          .wrapper.dark {
            background-color: var(--hunter-green);
          }
          .asset_name {
            color: #fff;
            font-size: 22px;
            font-weight: 500;
            line-height: 32px;
            text-transform: uppercase;
            margin-top: 7px;
          }
          .center {
            display: flex;
            flex-direction: column;
            align-items: center;
            position: absolute;
            top: -36px;
            left: 0px;
            right: 0px;
            pointer-events: none;
          }
          .type {
            height: 17px;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #a4cfff;
            background: #0b4789;
            font-size: 12px;
            padding: 0 4px;
            line-height: 17px;
            max-width: 40px;
          }
          .deposit_wrap {
            margin-top: 20px;
            height: 154px;
          }
          .confirm {
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .lock {
            height: 13px;
            padding-right: 4px;
            display: inline-block;
          }
          .rewards {
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            padding: 4px;
            background-color: var(--green-120);
          }
        `}
      </style>
    </>
  )
}
