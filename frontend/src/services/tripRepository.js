// Adapter for the backend repository API. Ownership comes from the session JWT,
// never a user ID supplied by a component.
export function createTripRepository(client) {
  async function call(name, args = {}) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }
  async function one(name, args) {
    const rows = await call(name, args);
    if (!rows?.length) throw new Error('Saved scenario not found.');
    return rows[0];
  }
  return {
    list: () => call('trip_repository_list'),
    get: (id) => one('trip_repository_get', { p_id: id }),
    create: (scenario, report) => one('trip_repository_create', { p_scenario: scenario, p_report: report }),
    update: (id, scenario, report) => one('trip_repository_update', { p_id: id, p_scenario: scenario, p_report: report }),
    remove: async (id) => {
      const deleted = await call('trip_repository_delete', { p_id: id });
      if (!deleted) throw new Error('Saved scenario not found.');
    },
  };
}
