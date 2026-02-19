import { Mark } from '@tiptap/core';

/**
 * ClientEditMark - Tiptap Mark extension for highlighting client edits in red
 * Used in shared notes to differentiate text added/edited by external clients
 */
export const ClientEditMark = Mark.create({
  name: 'clientEdit',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      author: {
        default: null,
        parseHTML: element => element.getAttribute('data-author'),
        renderHTML: attributes => {
          if (!attributes.author) {
            return {};
          }
          return {
            'data-author': attributes.author,
          };
        },
      },
      timestamp: {
        default: null,
        parseHTML: element => element.getAttribute('data-timestamp'),
        renderHTML: attributes => {
          if (!attributes.timestamp) {
            return {};
          }
          return {
            'data-timestamp': attributes.timestamp,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-client-edit]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...this.options.HTMLAttributes,
        ...HTMLAttributes,
        'data-client-edit': '',
        style: 'color: #DC2626; background-color: #FEE2E2; border-radius: 2px; padding: 0 2px;',
      },
      0,
    ];
  },

  addCommands() {
    return {
      setClientEdit: (attributes) => ({ commands }) => {
        return commands.setMark(this.name, attributes);
      },
      toggleClientEdit: (attributes) => ({ commands }) => {
        return commands.toggleMark(this.name, attributes);
      },
      unsetClientEdit: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },
});

export default ClientEditMark;
