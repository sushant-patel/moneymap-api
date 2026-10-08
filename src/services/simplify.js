export function simplifyDebts(balances) {
    // Owed money, biggest first
    const creditors = balances
        .filter((b) => b.balance > 0)
        .map((b) => ({ ...b }))
        .sort((a, b) => b.balance - a.balance);

    // Owe money, biggest first (as positive numbers)
    const debtors = balances
        .filter((b) => b.balance < 0)
        .map((b) => ({ ...b, balance: -b.balance }))
        .sort((a, b) => b.balance - a.balance);

    const payments = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const amount = Math.min(debtor.balance, creditor.balance);

        payments.push({
            from: { id: debtor.userId, name: debtor.name },
            to: { id: creditor.userId, name: creditor.name },
            amount,
        });

        debtor.balance -= amount;
        creditor.balance -= amount;

        if (debtor.balance === 0) i++;
        if (creditor.balance === 0) j++;
    }

    return payments;
}