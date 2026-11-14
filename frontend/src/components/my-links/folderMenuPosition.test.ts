import { folderMenuPosition } from './folderMenuPosition';

test('normal viewport opens right/down without horizontal centering or left alignment to card', () => {
  expect(folderMenuPosition({ left: 340, bottom: 100 }, 112, 134, { width: 1000, height: 800 }))
    .toEqual({ left: 340, top: 104 });
});
test('narrow viewport minimally shifts only overflowing axes; never flips by folder region', () => {
  expect(folderMenuPosition({ left: 300, bottom: 450 }, 112, 134, { width: 360, height: 500 }))
    .toEqual({ left: 240, top: 358 });
  expect(folderMenuPosition({ left: -20, bottom: -10 }, 112, 134, { width: 360, height: 500 }))
    .toEqual({ left: 8, top: 8 });
});
