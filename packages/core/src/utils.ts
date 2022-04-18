const isEqual = (x: any[], y: any[]) =>
  Array.isArray(x)
    ? Array.isArray(y) &&
      x.every(xi => y.includes(xi)) &&
      y.every(yi => x.includes(yi))
    : x === y;

const mergeRanges = (rangeList: any) => {
  const mergedQueue = [];
  const inputQueue = [...rangeList];
  while (inputQueue.length) {
    const cur = inputQueue.pop();
    const overlapIndex = mergedQueue.findIndex(
      item =>
        (item.start >= cur.start && item.start <= cur.end) ||
        (item.end >= cur.start && item.end <= cur.end)
    );

    if (overlapIndex === -1) {
      mergedQueue.push(cur);
    } else {
      const toMerge = mergedQueue.splice(overlapIndex, 1)[0];
      inputQueue.push({
        start: Math.min(cur.start, cur.end, toMerge.start, toMerge.end),
        end: Math.max(cur.start, cur.end, toMerge.start, toMerge.end),
      });
    }
  }

  return mergedQueue;
};

const sqr = (x: number) => x * x;
const mean = (xs: any[]) => xs.reduce((acc: any, x: any) => acc + x, 0) / xs.length;
const median = (xs: any[]) => xs.sort()[Math.floor(xs.length / 2)];
const variance = (xs: any[], mean: number) =>
  xs.reduce((acc: number, x: number) => acc + sqr(x - mean), 0) / (xs.length - 1);
const range = (xs: any[]) =>
  xs.reduce(
    (acc: { start: number; end: number; }, x: number) => ({
      start: Math.min(x, acc.start),
      end: Math.max(x, acc.end),
    }),
    { start: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY }
  );

export const getModuleName = (module: { userRequest: any; }) => module.userRequest;

export const getLoaderNames = (loaders: any[]) =>
  loaders && loaders.length
    ? loaders
        .map((l: { loader: any; }) => l.loader || l)
        .map((l: string) =>
          l
            .replace(/\\/g, '/')
            .replace(
              /^.*\/node_modules\/(@[a-z0-9][\w-.]+\/[a-z0-9][\w-.]*|[^\/]+).*$/,
              (_: any, m: any) => m
            )
        )
        .filter((l: string | string[]) => !l.includes('speed-measure-webpack-plugin'))
    : ['modules with no loaders'];

export const groupBy = (key: string, arr: any) => {
  const groups: any[][] = [];
  (arr || []).forEach((arrItem: { [x: string]: any; }) => {
    const groupItem = groups.find(poss => isEqual(poss[0][key], arrItem[key]));
    if (groupItem) groupItem.push(arrItem);
    else groups.push([arrItem]);
  });

  return groups;
};

export const getAverages = (group: any[]) => {
  const durationList = group.map((cur: { end: number; start: number; }) => cur.end - cur.start);

  const averages = {} as any;
  averages.dataPoints = group.length;
  averages.median = median(durationList);
  averages.mean = Math.round(mean(durationList));
  averages.range = range(durationList);
  if (group.length > 1)
    averages.variance = Math.round(variance(durationList, averages.mean));

  return averages;
};

export const getTotalActiveTime = (group: any) => {
  const mergedRanges = mergeRanges(group);
  return mergedRanges.reduce((acc, range) => acc + range.end - range.start, 0);
};

export const prependLoader = (rules: { map: (arg0: (rules: any) => any) => any; loader: any; use: any[]; options: any; oneOf: any; rules: any; resource: { and: any; or: any; }; }) => {
  if (!rules) return rules;
  if (Array.isArray(rules)) return rules.map(prependLoader);

  if (rules.loader) {
    rules.use = [rules.loader];
    if (rules.options) {
      rules.use[0] = { loader: rules.loader, options: rules.options };
      delete rules.options;
    }
    delete rules.loader;
  }

  if (rules.use) {
    if (!Array.isArray(rules.use)) rules.use = [rules.use];
    rules.use.unshift('speed-measure-webpack-plugin/loader');
  }

  if (rules.oneOf) {
    rules.oneOf = prependLoader(rules.oneOf);
  }
  if (rules.rules) {
    rules.rules = prependLoader(rules.rules);
  }
  if (Array.isArray(rules.resource)) {
    rules.resource = prependLoader(rules.resource);
  }
  if (rules.resource && rules.resource.and) {
    rules.resource.and = prependLoader(rules.resource.and);
  }
  if (rules.resource && rules.resource.or) {
    rules.resource.or = prependLoader(rules.resource.or);
  }

  return rules;
};

export const hackWrapLoaders = (loaderPaths: string | any[], callback: (arg0: any, arg1: any) => any) => {
  const wrapReq = (reqMethod: { apply: (arg0: any, arg1: IArguments) => any; }) => {
    return function () {
      const ret = reqMethod.apply(this, arguments);
      if (loaderPaths.includes(arguments[0])) {
        if (ret.__smpHacked) return ret;
        ret.__smpHacked = true;
        return callback(ret, arguments[0]);
      }
      return ret;
    };
  };

  if (typeof System === 'object' && typeof System.import === 'function') {
    System.import = wrapReq(System.import);
  }
  const Module = require('module');
  Module.prototype.require = wrapReq(Module.prototype.require);
};

const toCamelCase = (s: string) => s.replace(/(\-\w)/g, (m: string[]) => m[1].toUpperCase());

export const tap = (obj: { hooks: { [x: string]: { tap: (arg0: string, arg1: any) => any; }; }; plugin: (arg0: any, arg1: any) => any; }, hookName: any, func: any) => {
  if (obj.hooks) {
    return obj.hooks[toCamelCase(hookName)].tap('smp', func);
  }
  return obj.plugin(hookName, func);
};

export const getLoaderName = (loaderStr: string) => {
  // _babel-loader@8.2.3@babel-loader
  // _@alipay_lake-html@1.14.1@@alipay
  const result = /(.+)@\d+\.\d+\.\d+@/.exec(loaderStr);
  if (result === null) {
    return loaderStr;
  }

  // convert `_@alipay_lake-html` => @alipay/lake-html
  return result[1].replace(/^_(@.+)_(.+)/, '$1/$2');
};
