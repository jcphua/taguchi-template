var qunit = require("qunit"),
	jsonpointer = require("template/jsonpointer");

qunit.module("template/jsonpointer");

var struct = {
    aList: [1, 2, 3, 4, {aString: "test"}, "test", ["a", "b"]],
    aString: "test",
    anInt: 5,
    anObj: {
        aString: "another test",
        aList: [{objA: "1"}, {objB: "2"}, {objC: "3", strA: "a"}]
    }
};

qunit.test("get", function() {
    qunit.expect(17);

    qunit.equal(jsonpointer.get(struct, "/"), struct);
    qunit.equal(jsonpointer.get(struct, "/aList"), struct.aList);
    qunit.equal(jsonpointer.get(struct, "/anInt"), 5);
    qunit.equal(jsonpointer.get(struct, "/anInt/0"), undefined);
    qunit.equal(jsonpointer.get(struct, "/aString"), "test");
    qunit.equal(jsonpointer.get(struct, "/aString/test"), undefined);
    qunit.equal(jsonpointer.get(struct, "/anObj"), struct.anObj);
    qunit.equal(jsonpointer.get(struct, "/anObj/1"), undefined);
    qunit.equal(jsonpointer.get(struct, "/anObj/aList/2/objC"), "3");
    qunit.equal(jsonpointer.get(struct, "/0"), undefined);
    qunit.equal(jsonpointer.get(struct, "/nonExist/XYZ"), undefined);
    qunit.equal(jsonpointer.get(struct, "/aList/0"), 1);
    qunit.equal(jsonpointer.get(struct, "/aList/4/aString"), "test");
    qunit.equal(jsonpointer.get(struct, "/aList/6/0"), "a");
    qunit.equal(jsonpointer.get(struct, "/aList/7"), undefined);
    qunit.equal(jsonpointer.get(struct, "/aList/6/3"), undefined);
    qunit.equal(jsonpointer.get(struct, "/aList/test/0"), undefined);
});

qunit.test("set", function() {
    qunit.expect(17);

    qunit.throws(jsonpointer.set(struct, "/", {}), struct);

    qunit.equal(jsonpointer.set(struct, "/aList/test/0"), undefined);
    qunit.equal(jsonpointer.set(struct, "/aList/6/3"), undefined);
    qunit.equal(jsonpointer.set(struct, "/aList/7"), undefined);
    qunit.equal(jsonpointer.set(struct, "/aList/6/0"), "a");
    qunit.equal(jsonpointer.set(struct, "/aList/4/aString"), "test");
    qunit.equal(jsonpointer.set(struct, "/aList/0"), 1);
    qunit.equal(jsonpointer.set(struct, "/nonExist/XYZ"), undefined);
    qunit.equal(jsonpointer.set(struct, "/0"), undefined);
    qunit.equal(jsonpointer.set(struct, "/anObj/aList/2/objC"), "3");
    qunit.equal(jsonpointer.set(struct, "/anObj/1"), undefined);
    qunit.equal(jsonpointer.set(struct, "/anObj"), struct.anObj);
    qunit.equal(jsonpointer.set(struct, "/aString/`test"), undefined);
    qunit.equal(jsonpointer.set(struct, "/aString"), "test");
    qunit.equal(jsonpointer.set(struct, "/anInt/0"), undefined);
    qunit.equal(jsonpointer.set(struct, "/anInt"), 5);
    qunit.equal(jsonpointer.set(struct, "/aList", ), struct.aList);
});
