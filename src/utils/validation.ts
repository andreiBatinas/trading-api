const isNumeric = (value: any) => {
  if (typeof value === 'number') {
    return true;
  }
  return false;
};

export { isNumeric };
