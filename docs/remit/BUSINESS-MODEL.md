# The €5 flat fee — does it actually work?

You asked for a build, not a cheerleader. This is the honest read on the
business model the product implements.

Everything below is an **estimate** from public pricing and typical industry
ranges, not a quote from a provider. Treat the structure as sound and the
numbers as needing verification before you rely on them.

---

## 1. Unit economics of a €300 IE → ZA transfer

| Line | Estimate | Note |
|---|---|---|
| Transfer fee **revenue** | **+ €5.00** | |
| Pay-in cost (SEPA / open banking) | − €0.20 to €0.50 | Estimate |
| Pay-in cost **if card** | − €4.50 | ~1.4% + €0.25 on €305 |
| FX cost (wholesale spread you absorb at 0% margin) | − €0.60 to €1.20 | 20–40 bps on €300 |
| Payout to a South African bank account | − €0.50 to €1.50 | Estimate; partner- and volume-dependent |
| Sanctions/PEP screening | − €0.05 to €0.20 | Per transfer |
| **Contribution (bank pay-in)** | **≈ €2.00 – €3.60** | |
| **Contribution (card pay-in)** | **≈ −€2.00 to −€1.00** | Loss-making |

Plus a one-off **≈ €1.50 – €3.00 KYC cost per customer**, not per transfer.

### Three things that fall straight out of this

**1. Card pay-in kills the model at €5 flat.** Acquiring costs more than the
entire fee. This is why `DEBIT_CARD` is seeded as *configured but disabled* on
the corridor: bank transfer / open banking has to be the default, and card
should only ever be enabled with a card surcharge or a higher fee tier.

**2. Zero FX margin means you eat the FX spread.** That is a real cost of
roughly €0.60–1.20 on €300 that comes out of the €5. It is a defensible choice —
it is the whole "know the cost" proposition — but it is a choice, not free. The
corridor's `fxMarginBps` is configurable per corridor from the admin UI for
exactly this reason; set it to 25 bps and you recover the FX cost while still
disclosing it as a separate line, which no competitor does.

**3. You need real volume.** At ~€3 contribution per transfer, covering even a
modest €10,000/month of fixed cost (compliance officer, provider minimums,
hosting, support) takes **~3,300 transfers a month**. That is a real business
with real marketing spend behind it, not a side project.

---

## 2. The uncomfortable competitive question

**€5 flat is not obviously cheaper than the incumbents on a €300 transfer.**

Wise on EUR→ZAR charges roughly a small fixed amount plus ~0.5–0.7%, which lands
somewhere near €3 on €300. Your €5 is *more expensive* there.

Where flat pricing genuinely wins is **larger transfers**:

| Send amount | €5 flat | ~0.6% + fixed | Who wins |
|---|---|---|---|
| €100 | €5.00 | ~€1.50 | Them, clearly |
| €300 | €5.00 | ~€3.00 | Them |
| €1,000 | €5.00 | ~€7.00 | **You** |
| €3,000 | €5.00 | ~€19.00 | **You, decisively** |

The break-even is somewhere around **€700–800**.

### What I would actually do

Do not market "cheapest". Market **"€5, whatever you send"** and aim it at people
sending £500+ — supporting family, paying school fees, property, sending savings
home. That is where the message is both true and compelling, and those customers
are more valuable and more loyal than someone sending €50.

Three concrete options the code already supports:

- **Set a minimum send amount** of €150–200 so the smallest tickets, where you
  are both uncompetitive and unprofitable, simply are not offered. (Corridor
  `minAmountMinor`, editable in admin.)
- **Take a small, disclosed FX margin** of ~25 bps to cover the FX cost. Still
  radically more transparent than anyone else, because you show it.
- **A tiered fee rule**: €5 standard, a higher fixed fee above €5,000 where the
  compliance burden per transfer genuinely rises. That is one row in the fee
  table.

---

## 3. The real barrier is not the software

You now have the software. The blockers are, in order of difficulty:

1. **Authorisation.** A Payment Institution licence in Ireland needs initial
   capital (in the region of €125k for money-remittance PIs), a fit-and-proper
   management team, a compliance officer, written AML/CFT policies, and a
   Central Bank application that realistically takes 6–12 months and six figures
   in legal and consulting fees.
2. **The agent route is the realistic start.** Operating as a registered agent
   of an already-authorised payment institution is dramatically cheaper and
   faster. You give up margin and some control; you get to find out whether
   anyone wants this before spending €300k. **This is what I would do.**
3. **A South African payout partner.** You need a licensed partner who can pay
   into local bank accounts, and they will want volume commitments and diligence
   on you.
4. **Safeguarding.** Even as an agent, customer funds must be handled by the
   authorised firm. The architecture already assumes this — you never hold a
   balance — which is the single most important structural decision here.

---

## 4. What the dashboard tracks, and why

The admin overview deliberately does **not** show "revenue = fees collected".
It shows:

```
fee revenue + FX margin revenue − provider costs = gross margin
```

Provider costs are recorded per transfer, on both legs, from what the providers
actually charge. If gross margin goes negative the dashboard says so in red,
because the failure mode of a flat-fee remittance business is looking healthy on
volume while losing money on every transaction.

Per-transfer contribution is on each transfer's admin detail page, so you can
see which corridors, amounts and payment methods actually pay.

---

## 5. Honest summary

- The **product** is sound and the architecture is the right shape.
- The **flat €5** is a genuinely good, differentiated position — for transfers
  above roughly €700. Below that it is a worse deal than Wise and you should not
  claim otherwise.
- The **economics work** on bank pay-in at ~€3/transfer contribution, and do not
  work at all on card.
- The **binding constraint is regulatory**, and the agent-of-an-authorised-firm
  route is the only sensible way to test the market.
- Do not assume the €5 is profit. It is roughly €3, before you have paid
  yourself, marketed anything, or verified a single customer.
