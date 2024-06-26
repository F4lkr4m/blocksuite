import type {
  BlockSelection,
  EditorHost,
  TextSelection,
} from '@blocksuite/block-std';
import type { EdgelessRootService, SerializedXYWH } from '@blocksuite/blocks';
import {
  BlocksUtils,
  Bound,
  getElementsBound,
  NoteDisplayMode,
} from '@blocksuite/blocks';
import { Text } from '@blocksuite/store';

import {
  CreateIcon,
  InsertBelowIcon,
  ReplaceIcon,
} from '../../_common/icons.js';
import { insertBelow, replace } from '../../utils/editor-actions.js';
import { insertFromMarkdown } from '../../utils/markdown-utils.js';

const { matchFlavours } = BlocksUtils;

const CommonActions = [
  {
    icon: ReplaceIcon,
    title: 'Replace selection',
    handler: async (
      host: EditorHost,
      content: string,
      currentTextSelection?: TextSelection,
      currentBlockSelections?: BlockSelection[]
    ) => {
      const [_, data] = host.command
        .chain()
        .getSelectedBlocks({
          currentTextSelection,
          currentBlockSelections,
        })
        .run();
      if (!data.selectedBlocks) return;

      if (currentTextSelection) {
        const { doc } = host;
        const block = doc.getBlock(currentTextSelection.blockId);
        if (matchFlavours(block?.model ?? null, ['affine:paragraph'])) {
          block?.model.text?.replace(
            currentTextSelection.from.index,
            currentTextSelection.from.length,
            content
          );
          return;
        }
      }

      await replace(
        host,
        content,
        data.selectedBlocks[0],
        data.selectedBlocks.map(block => block.model),
        currentTextSelection
      );
    },
  },
  {
    icon: InsertBelowIcon,
    title: 'Insert below',
    handler: async (
      host: EditorHost,
      content: string,
      currentTextSelection?: TextSelection,
      currentBlockSelections?: BlockSelection[]
    ) => {
      const [_, data] = host.command
        .chain()
        .getSelectedBlocks({
          currentTextSelection,
          currentBlockSelections,
        })
        .run();
      if (!data.selectedBlocks) return;

      await insertBelow(
        host,
        content,
        data.selectedBlocks[data.selectedBlocks?.length - 1]
      );
    },
  },
];

export const PageEditorActions = [
  ...CommonActions,
  {
    icon: CreateIcon,
    title: 'Create as a page',
    handler: (host: EditorHost, content: string) => {
      const newDoc = host.doc.collection.createDoc();
      newDoc.load();
      const rootId = newDoc.addBlock('affine:page');
      newDoc.addBlock('affine:surface', {}, rootId);
      const noteId = newDoc.addBlock('affine:note', {}, rootId);
      newDoc.addBlock('affine:paragraph', { text: new Text(content) }, noteId);
      host.spec.getService('affine:page').slots.docLinkClicked.emit({
        docId: newDoc.id,
      });
    },
  },
];

export const EdgelessEditorActions = [
  ...CommonActions,
  {
    icon: CreateIcon,
    title: 'Add to edgeless as note',
    handler: async (host: EditorHost, content: string) => {
      const { doc } = host;
      const service = host.spec.getService<EdgelessRootService>('affine:page');
      const elements = service.selection.elements;

      const props: { displayMode: NoteDisplayMode; xywh?: SerializedXYWH } = {
        displayMode: NoteDisplayMode.EdgelessOnly,
      };

      if (elements.length > 0) {
        const bound = getElementsBound(
          elements.map(e => Bound.deserialize(e.xywh))
        );
        const newBound = new Bound(bound.x, bound.maxY + 10, bound.w);
        props.xywh = newBound.serialize();
      }

      const id = doc.addBlock('affine:note', props, doc.root?.id);

      await insertFromMarkdown(host, content, id, 0);

      service.selection.set({
        elements: [id],
        editing: false,
      });
    },
  },
];
