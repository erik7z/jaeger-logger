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

    const args = [1, fca, 2, fcb];
    const newArgs = Logger.simplifyArgs(args, ['FakeClassA']);

    expect(newArgs).toStrictEqual([1, 'FakeClassA', 2, fcb]);
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

    const args = [1, nested, 2, fcb];
    const newArgs = Logger.simplifyArgs(args, ['FakeClassA']);

    expect(newArgs).toStrictEqual([1, nestedReplaced, 2, fcb]);
  });

  test('Should replace args of type Buffer', () => {
    const buff = Buffer.from('abc');

    class FakeClassB {
      constructor(public a: number, public b: string) {}
    }

    const fcb = new FakeClassB(1, 'b');

    const args = [1, buff, 2, fcb];
    const newArgs = Logger.simplifyArgs(args, ['FakeClassA']);

    expect(newArgs).toStrictEqual([1, 'Buffer', 2, fcb]);
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
    const args = [1, nested, 2, fcb];
    const newArgs = Logger.simplifyArgs(args, ['FakeClassA']);

    expect(newArgs).toStrictEqual([1, nestedReplaced, 2, fcb]);
  });
});
