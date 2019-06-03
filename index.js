// const types = require('babel-types');

module.exports = exports.default = function ImportHookPlugin(babel) {
	const types = babel.types;

	return {
		visitor: {
			ImportDeclaration(path, { opts }) {
				if (!path.node) return;
				// const types = require('babel-types');
				let { source, specifiers = [] } = path.node;
				if (!specifiers) {
					specifiers = [];
				}
				const { value } = source;

				let { libraryName = '', customName: nameHook = v => v } = opts;
				libraryName = String(libraryName);
				let matched = false;
				if (/^\/.*\/$/.test(libraryName)) {
					matched = new RegExp(libraryName.slice(1, -1)).test(value);
				}
				if (value !== libraryName && !matched) return;
				// console.log('leo ImportDeclaration------ ??? value', value, value !== libraryName && !matched, /^\/.*\/$/.test(libraryName), new RegExp(libraryName).test(value));

				/*
				// N.B: import hook: hook的含义就是不管什么样的import，都会从管道中走一遍，所以将这段（用于按需加载的优化）注释掉了
				let isAllImport = false;
				if (specifiers.length === 0) {
					isAllImport = true;
				} else {
					isAllImport = specifiers.some(spec => {
						const { type: typeName } = spec;
						return typeName === 'ImportNamespaceSpecifier' || typeName === 'ImportDefaultSpecifier';
					})
				}
				// console.log('isAllImport', isAllImport)
				if (isAllImport) return;
				*/

				const newSpecsData = [];
				const prevSpecsData = [];
				specifiers.forEach((spec) => {
					const { imported = {}, local = {}, type: typeName } = spec;
					// console.log('spec', typeName)
					const importedName = imported.name;
					const localName = local.name;
					let isDefaultImport = typeName !== 'ImportSpecifier';
					const option = {
						value,
						importedName,
						name: importedName || localName,
						isDefaultImport: typeName !== 'ImportSpecifier',
						type: typeName,
						localName
					}
					prevSpecsData.push(option);
					const coutomConfig = nameHook(option) || value;
					let pathname = coutomConfig;

					if (typeof coutomConfig === 'object') {
						pathname = coutomConfig.value;
					}

					newSpecsData.push(Object.assign({}, {
						value: pathname || value,
						importedName: coutomConfig.name || importedName,
						isDefaultImport,
						localName,
						type: typeName,
					}, typeof coutomConfig === 'object' ? coutomConfig : {}));

				});


				if (prevSpecsData.length === newSpecsData.length) {
					// N.B: 如果没发生变化，则直接return退出，防止死循环；to avoid endless loop.
					const isChanged = prevSpecsData.some((item, idx) => {
						const newItem = newSpecsData[idx];
						// console.log('?', item, newItem);
						const ret = (
							newItem.value !== item.value ||
							newItem.importedName !== item.importedName ||
							newItem.localName !== item.localName ||
							newItem.type !== item.type ||
							newItem.isDefaultImport !== item.isDefaultImport
						)
						// if (ret) console.log('?', item, newItem)
						return ret;
					});
					// console.log('isChanged', isChanged)
					if (!isChanged) {
						return;
					}
				}


				const map = newSpecsData.reduce((acc, cur) => {
					if (!acc[cur.value]) {
						acc[cur.value] = [cur];
					} else {
						acc[cur.value] = acc[cur.value].concat(cur);
					}
					return acc;
				}, {});

				const newSpecs = [];

				Object.keys(map).forEach(value => {
					const items = map[value];
					const nonDefaultList = items.filter(item => !item.isDefaultImport);
					const defaultList = items.filter(item => item.isDefaultImport);

					if (nonDefaultList.length) {
						newSpecs.push(types.importDeclaration(
							nonDefaultList.map(({ importedName, localName }) => types.importSpecifier(
								types.identifier(localName),
								types.identifier(importedName)
							)),
							types.stringLiteral(value)
						));
					}
					if (defaultList.length) {
						const namespaceList = defaultList.filter(item => item.type === 'ImportNamespaceSpecifier')
						if (namespaceList.length) {
							newSpecs.push(types.importDeclaration(
								namespaceList.map(({ importedName, localName }) => types.importNamespaceSpecifier(
									types.identifier(localName)
								)),
								types.stringLiteral(value)
							));
						}
						const restList = defaultList.filter(item => item.type === 'ImportDefaultSpecifier');
						if (restList.length) {
							newSpecs.push(types.importDeclaration(
								restList.map(({ importedName, localName }) => types.importDefaultSpecifier(
									types.identifier(localName)
								)),
								types.stringLiteral(value)
							));
						}
					}
				});

				if (newSpecs.length) {
					path.replaceWithMultiple(newSpecs);
				}
			}

		}
	};
};
