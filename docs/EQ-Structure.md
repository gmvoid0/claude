# Easy Qualifier, as it actually is

Recorded from a live capture on `easyqualifier.uwm.com`, 18 Aug 2026, with the
probe in `tools/eq-probe.js`. Broker and loan-officer identifiers are scrubbed.
This is the reference the fill map is built from — everything below was read off
the page, not guessed.

## Shape

- **One page, not a wizard.** Everything lives under a single `Loan Information`
  heading at `/`. React. Roughly seventy fields.
- **Every dropdown is a pair.** A `<div role="combobox" id="X">` for the control,
  and an `<input name="X">` beside it holding the chosen text. To set one you
  open the div and click an option; to read it back you look at the input. You
  cannot fill it by writing to the input.
- **`LoanTypeIds` takes more than one program at a time.** A capture had
  Conventional, FHA and VA all selected together, which is how EQ prices them
  side by side. That is the mechanism for showing a borrower two programs at
  once.

## The one option list captured so far

`LoanTypeIds` — `0` Conventional · `1` Conventional ARM · `2` FHA · `3` FHA ARM
· `4` VA · `6` VA ARM · `5` USDA. Note that VA is `4` but VA ARM is `6`: the
values are not in listed order, so they have to be read rather than counted.

## Traps

**Ids that move with the program.** Two fields are renamed depending on what is
selected, so a map keyed on one id alone silently misses:

| Field | Id when | Id when |
| --- | --- | --- |
| Loan Term | `LoanTermIds40` — a 40-year term is on offer | `LoanTermIds` — FHA alone |
| Borrower Income | `MonthlyIncome` — required | `MonthlyIncomeOptional` — not required |

**Fields that only exist for some programs.** `useMortgageInsuranceTypeIds`
(VA Use Type) appears when VA is selected. `FinancedMortgageInsuranceTypeId`
(UFMIP / funding fee) appears for FHA and VA. `ClosingType` disappeared on an
FHA-only scenario. So the fill has to be ordered: **program first**, then wait
for the page to settle, then everything that depends on it.

**Fields derived from others.** `PropertyState` is disabled and follows
`PropertyZipCode`; `PropertyCounty` is populated from the ZIP too and carries
the area median income beside it. Fill the ZIP, wait, then the county.

**`SalesPrice` is disabled on a refinance.** `AppraisedValue` is the home value.

## The fields

### Broker — already filled, leave alone
`ObfuscatedBusinessEntityId` (Company Name) · `ObfuscatedLoanOfficerContactId`
(Loan Officer) · `CompensationPayerTypeID` (disabled, Borrower paid) ·
`isCorrespondent` (Price As Correspondent)

### Borrower
| Id | Label | Kind |
| --- | --- | --- |
| `BorrowerName` | Borrower Name | text, required |
| `CreditScore` | Qualifying Credit Score | text, required |
| `CreditScoreCategoryTypeId` | Credit Model (FICO) | dropdown, often disabled |
| `MonthlyIncome` / `MonthlyIncomeOptional` | Borrower Income | money |
| `MonthlyDebt` | Monthly Debt | money |
| `isDTIOver45Percent` | DTI Over 45% | dropdown |
| `EmploymentOptions` | Employment | dropdown |
| `MonthsOfReservesId` | Months of Reserves | text |
| `NumberOfBorrowers` | Number of Borrowers | dropdown |

### Loan
| Id | Label | Kind |
| --- | --- | --- |
| `LoanTypeIds` | Loan Type | dropdown, **multi-select** |
| `PurposeTypeId` | Loan Purpose | dropdown |
| `RefinancePurposeID` | Refinance Purpose (Cash Out) | dropdown |
| `useMortgageInsuranceTypeIds` | VA Use Type | dropdown, VA only |
| `FinancedMortgageInsuranceTypeId` | UFMIP / Funding Fee Type | dropdown, FHA + VA |
| `LoanAmount` | Loan Amount | money, required |
| `SecondLoanAmount` | Second Loan Amount | money |
| `LoanToValue` | LTV | percent |
| `LoanTermIds` / `LoanTermIds40` | Loan Term | dropdown |
| `IncludeFlexTerms` | Flex Term | dropdown |
| `CommitmentPeriodID` | Lock Period | dropdown |

### Property
| Id | Label | Kind |
| --- | --- | --- |
| `AppraisedValue` | Appraised Value | money, required — **the home value** |
| `SalesPrice` | Sales Price | money, disabled on a refinance |
| `PropertyZipCode` | ZIP Code | text, required — drives county and state |
| `PropertyCounty` | Property County | dropdown |
| `PropertyState` | Property State | dropdown, disabled |
| `OccupancyTypeId` | Occupancy | dropdown |
| `PropertyTypeID` | Property Type | dropdown |
| `AnnualTaxes` | Taxes (annual) | money |
| `AnnualHomeownersInsurance` | Homeowners Insurance (annual) | money |
| `EscrowWaiverTypeId` | Escrow / Impound Waiver | dropdown |

### Pricing controls
`ExactRateTypeId` (Target Price) · `TargetPriceValue` (%) · `TargetCashValue`
($) · `AnnualPercentageRateFees` (Finance Charges) · `TRACTypeId` (Title
Selection) · `WaivableFeeTypeIds` · `LoanShieldTypeId` · `PAPlusTypeId`
(Processing Option) · `ClosingType` · `BullseyeIncentive`

## What S.A.M can fill from an application it already has

Directly: `BorrowerName`, `AppraisedValue`, `LoanAmount`, `SecondLoanAmount`,
`CreditScore`, `PropertyZipCode`, `LoanTypeIds`, `PurposeTypeId`,
`RefinancePurposeID`, `MonthlyDebt`, `AnnualTaxes`,
`AnnualHomeownersInsurance`, and the VA fields when the program is VA.

Still needed from the agent, which is why they belong on the panel rather than
in a preset: occupancy, property type, county, monthly debts, income, escrow
waiver.

## Still missing

The option lists for every dropdown but Loan Type, and the results area. Both
are covered by the second pass — the **Read all dropdown lists** and **Read the
results** buttons.
