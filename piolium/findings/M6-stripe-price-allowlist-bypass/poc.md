# PoC — unapproved Stripe price lookup key

PoC-Status: blocked
PoC-Block-Reason: no disposable live Stripe catalog/payment account.

Safe reproduction in a test Stripe account:

1. Configure the expected Pro monthly/yearly prices.
2. Add a cheaper active recurring price with lookup key `audit-cheap` under any product.
3. As an authenticated test user, request `/api/create-checkout-session?lookup_key=audit-cheap`.
4. Complete the test checkout.
5. Deliver only `checkout.session.completed` or delay `customer.subscription.created`.
6. Observe that the handler records Pro without checking the selected price.

Do not execute against a production account. Exploitability requires another active recurring price and knowledge/guessability of its lookup key.
