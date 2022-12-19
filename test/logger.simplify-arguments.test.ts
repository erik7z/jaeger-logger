import Logger from '../src/logger';

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
});
