import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    adoptServerIds,
    insertFields,
    isStaleLiveSave,
    keepStableFileUrl,
    mergeDocumentFileUrls,
    patchFields,
    remapIds,
    removeFields,
    restoreRemoved,
    revertIfUnchanged,
    swapFieldId,
} from './field-live';

describe('patchFields / revertIfUnchanged', () => {
    const fields = [
        { id: 'a', posicao_x: 10, posicao_y: 20, obrigatorio: true },
        { id: 'b', posicao_x: 1, posicao_y: 2, obrigatorio: true },
    ];

    it('atualiza só o campo arrastado', () => {
        const next = patchFields(fields, [{ id: 'a', posicao_x: 40, posicao_y: 50 }]);
        assert.equal(next[0].posicao_x, 40);
        assert.equal(next[1].posicao_x, 1);
    });

    it('reverte o PATCH que falhou e preserva um gesto mais novo', () => {
        const optimistic = [{ id: 'a', posicao_x: 40, posicao_y: 50 }];
        const snapshots = [fields[0]];
        const still = revertIfUnchanged(
            patchFields(fields, optimistic),
            optimistic,
            snapshots,
        );
        assert.equal(still[0].posicao_x, 10);

        const newer = patchFields(fields, [{ id: 'a', posicao_x: 99, posicao_y: 50 }]);
        const kept = revertIfUnchanged(newer, optimistic, snapshots);
        assert.equal(kept[0].posicao_x, 99);
    });
});

describe('insert / remove / swap', () => {
    it('tira e devolve o campo excluído sem duplicar', () => {
        const fields = [{ id: 'a' }, { id: 'b' }];
        const removed = removeFields(fields, ['a']);
        assert.deepEqual(removed.map((f) => f.id), ['b']);
        const restored = restoreRemoved(removed, [fields[0]]);
        assert.deepEqual(restored.map((f) => f.id), ['b', 'a']);
        assert.equal(restoreRemoved(restored, [fields[0]]).length, 2);
    });

    it('troca id temporário e não reinsere cópia já presente', () => {
        const withTemp = insertFields([{ id: 'a' }], [{ id: 'temp-1' }]);
        const swapped = swapFieldId(withTemp, 'temp-1', 'uuid-real');
        assert.deepEqual(swapped.map((f) => f.id), ['a', 'uuid-real']);
        assert.equal(insertFields(swapped, [{ id: 'a' }]).length, 2);
    });
});

describe('URL assinada estável', () => {
    it('mantém a URL quando só o token muda e troca quando o arquivo muda', () => {
        const prev = 'https://x/storage/v1/object/sign/bucket/a.pdf?token=1';
        const same = 'https://x/storage/v1/object/sign/bucket/a.pdf?token=2';
        const signed = 'https://x/storage/v1/object/sign/bucket/a-signed.pdf?token=3';
        assert.equal(keepStableFileUrl(prev, same), prev);
        assert.equal(keepStableFileUrl(prev, signed), signed);
        assert.equal(keepStableFileUrl(null, same), same);
    });

    it('não substitui arquivo_url dos documentos já abertos', () => {
        const prev = [{ id: 'd1', arquivo_url: 'https://x/a.pdf?token=1', titulo: 'A' }];
        const incoming = [{ id: 'd1', arquivo_url: 'https://x/a.pdf?token=9', titulo: 'A' }];
        const merged = mergeDocumentFileUrls(prev, incoming);
        assert.equal(merged[0].arquivo_url, prev[0].arquivo_url);
    });
});

describe('adoptServerIds', () => {
    it('grava o id real e mantém a posição que o usuário moveu depois', () => {
        const current = [{ id: 'temp-1', posicao_x: 80 }, { id: 'temp-2', posicao_x: 5 }];
        const adopted = adoptServerIds(current, [
            { id: '11111111-1111-4111-8111-111111111111', client_id: 'temp-1' },
        ]);
        assert.equal(adopted[0].id, '11111111-1111-4111-8111-111111111111');
        assert.equal(adopted[0].posicao_x, 80);
        assert.equal(adopted[1].id, 'temp-2');
        assert.deepEqual(
            remapIds(['temp-1', 'temp-2'], [{ id: '11111111-1111-4111-8111-111111111111', client_id: 'temp-1' }]),
            ['11111111-1111-4111-8111-111111111111', 'temp-2'],
        );
    });

    it('save antigo não deve ser aplicado', () => {
        assert.equal(isStaleLiveSave(1, 2), true);
        assert.equal(isStaleLiveSave(2, 2), false);
    });
});
