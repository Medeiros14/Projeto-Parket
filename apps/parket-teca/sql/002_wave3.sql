-- Wave 3 — LISTEN/NOTIFY realtime pra invalidar cache do grafo

CREATE OR REPLACE FUNCTION teca._notify_graph_change() RETURNS trigger AS $$
DECLARE
    payload text;
    node_id text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        node_id := OLD.id;
    ELSE
        node_id := NEW.id;
    END IF;
    payload := json_build_object(
        'op',    TG_OP,
        'table', TG_TABLE_NAME,
        'id',    node_id
    )::text;
    PERFORM pg_notify('teca_graph_change', payload);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teca_nodes_notify ON teca.nodes;
CREATE TRIGGER trg_teca_nodes_notify
AFTER INSERT OR UPDATE OR DELETE ON teca.nodes
FOR EACH ROW EXECUTE FUNCTION teca._notify_graph_change();

CREATE OR REPLACE FUNCTION teca._notify_edge_change() RETURNS trigger AS $$
DECLARE
    payload text;
BEGIN
    payload := json_build_object(
        'op',    TG_OP,
        'table', 'edges',
        'src',   COALESCE(NEW.src_id, OLD.src_id),
        'dst',   COALESCE(NEW.dst_id, OLD.dst_id)
    )::text;
    PERFORM pg_notify('teca_graph_change', payload);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teca_edges_notify ON teca.edges;
CREATE TRIGGER trg_teca_edges_notify
AFTER INSERT OR UPDATE OR DELETE ON teca.edges
FOR EACH ROW EXECUTE FUNCTION teca._notify_edge_change();
