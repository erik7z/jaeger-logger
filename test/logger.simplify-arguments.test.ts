import Logger from '../src/logger';
import * as Stream from 'node:stream';

describe('simplifyArgs', () => {
  test('Should replace provided classes with string class name', () => {
    class FakeClassA {
      constructor(public a: number, public b: string) {}
    }

    class FakeClassB {
      constructor(public a: number, public b: string) {}
    }

    const fca = new FakeClassA(1, 'a');
    const fcb = new FakeClassB(1, 'b');

    const arguments_ = [1, fca, 2, fcb];
    const newArguments = Logger.simplifyArgs(arguments_, ['FakeClassA']);

    expect(newArguments).toStrictEqual([1, 'FakeClassA', 2, fcb]);
  });

  test('Should replace nested provided classes with string class name', async () => {
    class FakeClassA {
      constructor(public a: number, public b: string) {}
    }

    class FakeClassB {
      constructor(public a: number, public b: string) {}
    }

    const fca = new FakeClassA(1, 'a');
    const fcb = new FakeClassB(1, 'b');

    const nested = {
      a: 'a',
      n: {
        n1: {
          fca,
        },
        b: 'b',
      },
    };

    const nestedReplaced = {
      a: 'a',
      n: {
        n1: {
          fca: 'FakeClassA',
        },
        b: 'b',
      },
    };

    const arguments_ = [1, nested, 2, fcb];
    const newArguments = Logger.simplifyArgs(arguments_, ['FakeClassA']);

    expect(newArguments).toStrictEqual([1, nestedReplaced, 2, fcb]);
  });

  test('Should ignore simple datatypes', () => {
    const newArguments = Logger.simplifyArgs(1, ['FakeClassA']);
    expect(newArguments).toStrictEqual(1);

    const newArguments1 = Logger.simplifyArgs('abc');
    expect(newArguments1).toStrictEqual('abc');
  });

  test('Should replace values if object datatype provided as argument', () => {
    const newArguments = Logger.simplifyArgs({ a: 'a', b: 'b' }, ['FakeClassA']);
    expect(newArguments).toStrictEqual({ a: 'a', b: 'b' });

    const buff = Buffer.from('abc');
    const newArguments1 = Logger.simplifyArgs({ a: 'a', b: buff });
    expect(newArguments1).toStrictEqual({ a: 'a', b: 'Buffer' });
  });

  test('Should replace args of type Buffer', () => {
    const buff = Buffer.from('abc');

    class FakeClassB {
      constructor(public a: number, public b: string) {}
    }

    const fcb = new FakeClassB(1, 'b');

    const arguments_ = [1, buff, 2, fcb];
    const newArguments = Logger.simplifyArgs(arguments_, ['FakeClassA']);

    expect(newArguments).toStrictEqual([1, 'Buffer', 2, fcb]);
  });

  test('Should replace nested args of type Buffer', () => {
    const buff = Buffer.from('abc');

    class FakeClassB {
      constructor(public a: number, public b: string) {}
    }

    const nested = {
      a: 'a',
      n: {
        n1: {
          buff,
        },
        b: 'b',
      },
    };

    const nestedReplaced = {
      a: 'a',
      n: {
        n1: {
          buff: 'Buffer',
        },
        b: 'b',
      },
    };

    const fcb = new FakeClassB(1, 'b');
    const arguments_ = [1, nested, 2, fcb];
    const newArguments = Logger.simplifyArgs(arguments_, ['FakeClassA']);

    expect(newArguments).toStrictEqual([1, nestedReplaced, 2, fcb]);
  });

  test('Should replace args of type Stream', () => {
    const stream = new Stream.Readable();

    const newArguments = Logger.simplifyArgs(stream, ['FakeClassA', 'Stream']);

    expect(newArguments).toStrictEqual('Stream');
  });

  test('Should replace nested args of type Stream', () => {
    const strm = new Stream.Readable();

    class FakeClassB {
      constructor(public a: number, public b: string) {}
    }

    const nested = {
      a: 'a',
      n: {
        n1: {
          strm: strm,
        },
        b: 'b',
      },
    };

    const nestedReplaced = {
      a: 'a',
      n: {
        n1: {
          strm: 'Stream',
        },
        b: 'b',
      },
    };

    const fcb = new FakeClassB(1, 'b');
    const arguments_ = [1, nested, 2, fcb];
    const newArguments = Logger.simplifyArgs(arguments_, ['FakeClassA']);

    expect(newArguments).toStrictEqual([1, nestedReplaced, 2, fcb]);
  });

  describe('replacePropertiesRecursive', () => {
    test('Should replace nested properties', () => {
      const strm = new Stream.Readable();

      const initialObject = {
        a: 'a',
        n: {
          n1: {
            strm: strm,
          },
          b: 'b',
        },
      };

      const expectedObject = {
        a: 'a',
        n: {
          n1: 'REPLACED',
          b: 'b',
        },
      };

      const replacedObject = Logger.replacePropertiesRecursive(initialObject, 'n1', 'REPLACED');

      expect(replacedObject).toStrictEqual(expectedObject);
    });

    test('Should replace multiple nested properties', () => {
      const strm = new Stream.Readable();

      const initialObject = {
        a: 'a',
        n: {
          n1: {
            strm: strm,
          },
          b: 'b',
          banana: {
            n1: {
              cucumber: 123,
            },
          },
        },
      };

      const expectedObject = {
        a: 'a',
        n: {
          n1: 'REPLACED',
          b: 'b',
          banana: {
            n1: 'REPLACED',
          },
        },
      };

      const replacedObject = Logger.replacePropertiesRecursive(initialObject, 'n1', 'REPLACED');

      expect(replacedObject).toStrictEqual(expectedObject);
    });

    test('Should not replace deeper than set depth', () => {
      const initialObject = {
        a: 'a',
        b: {
          b1: {
            b2: {
              b3: {
                deepData: 'deepData',
              },
              deepData: 'deepData3',
            },
          },
          deepData: 'deepData',
        },
      };

      const expectedObject = {
        a: 'a',
        b: {
          b1: {
            b2: {
              b3: {
                deepData: 'deepData',
              },
              deepData: 'REPLACED',
            },
          },
          deepData: 'REPLACED',
        },
      };

      const replacedObject = Logger.replacePropertiesRecursive(initialObject, 'deepData', 'REPLACED', 4);

      expect(replacedObject).toStrictEqual(expectedObject);
    });

    // TODO: correct (arrays will lose equal values)
    test('Should replace arrays with array objects', () => {
      const strm = new Stream.Readable();

      const initialObject = {
        a: 'a',
        n: {
          n1: {
            strm: strm,
          },
          b: 'b',
          banana: {
            n1: {
              cucumber: 123,
            },
          },
        },
      };

      const expectedObject = {
        a: 'a',
        n: {
          n1: 'REPLACED',
          b: 'b',
          banana: {
            n1: 'REPLACED',
          },
        },
      };

      const replacedObject = Logger.replacePropertiesRecursive([initialObject], 'n1', 'REPLACED');

      expect(replacedObject).toStrictEqual({ '0': expectedObject });
    });
  });
});
