function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function splitByShares(amount, splits) {
  const totalShares = splits.reduce((sum, s) => sum + s.value, 0);
  let assigned = 0;

  const result = splits.map((s) => {
    const owed = Math.floor((amount * s.value) / totalShares);
    assigned += owed;
    return { userId: s.userId, amountOwed: owed };
  });

  let leftover = amount - assigned;
  for (let i = 0; leftover > 0; i++, leftover--) {
    result[i % result.length].amountOwed += 1;
  }

  return result;
}

export function calculateSplits(amount, splitType, splits) {
  if (splitType === "EQUAL") {
    return splitByShares(amount, splits.map((s) => ({ userId: s.userId, value: 1 })));
  }

  if (splitType === "SHARES") {
    if (splits.some((s) => !Number.isInteger(s.value))) {
      throw badRequest("Each share must be a whole number");
    }
    return splitByShares(amount, splits);
  }

  if (splitType === "EXACT") {
    if (splits.some((s) => !Number.isInteger(s.value))) {
      throw badRequest("Each exact amount must be a whole number");
    }
    const total = splits.reduce((sum, s) => sum + s.value, 0);
    if (total !== amount) {
      throw badRequest(`Exact amounts add up to ${total}, but the expense is ${amount}`);
    }
    return splits.map((s) => ({ userId: s.userId, amountOwed: s.value }));
  }

  if (splitType === "PERCENTAGE") {
    if (splits.some((s) => s.value === undefined)) {
      throw badRequest("Each split needs a percentage value");
    }

    const asShares = splits.map((s) => ({
      userId: s.userId,
      value: Math.round(s.value * 100),
    }));

    const total = asShares.reduce((sum, s) => sum + s.value, 0);
    if (total !== 10000) {
      throw badRequest(`Percentages add up to ${total / 100}%, but must equal 100%`);
    }

    return splitByShares(amount, asShares);
  }

  throw badRequest(`${splitType} split is not supported yet`);
}